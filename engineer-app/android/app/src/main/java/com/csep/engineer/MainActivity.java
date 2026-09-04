package com.csep.engineer;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final String EFG_HIDE_CSS = "<style>"
            + ".footer,footer,.eb-backtotop{display:none!important}"
            + ".category-list,.board-info{display:none!important}"
            + ".bl-author,.bl-name-in,.bl-mobile{display:none!important}"
            + ".bl-list>.bl-item.text-gray{display:none!important}"
            + ".bl-list{border-bottom:1px solid #e0e0e0!important;padding:12px 0!important}"
            + "</style>";

    private android.content.SharedPreferences.OnSharedPreferenceChangeListener roleListener;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupEfgIntercept();
        setupBackButton();
        setupRoleWatcher();
        // 권한 요청·감지 서비스 시작은 onResume 에서 (로그인 역할이 정해진 뒤 실행되어야 함)
    }

    /**
     * 웹에서 로그인하면 Capacitor Preferences 에 csep_is_boss 가 기록된다.
     * 그 시점에 바로 권한 요청·전화감지 서비스를 켜기 위해 변경을 감시한다.
     * (예전처럼 onCreate 에서 무조건 켜면 일반 기사 폰에도 상시 알림이 떴다)
     */
    private void setupRoleWatcher() {
        try {
            final android.content.SharedPreferences sp =
                    getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
            roleListener = (prefs, key) -> {
                if (!"csep_is_boss".equals(key) && !"csep_role".equals(key)) return;
                runOnUiThread(() -> { startMonitor(); requestNeededPermissions(); });
            };
            sp.registerOnSharedPreferenceChangeListener(roleListener);
        } catch (Exception e) { /* ignore */ }
    }

    @Override
    public void onDestroy() {
        try {
            if (roleListener != null) {
                getSharedPreferences("CapacitorStorage", MODE_PRIVATE)
                        .unregisterOnSharedPreferenceChangeListener(roleListener);
            }
        } catch (Exception e) { /* ignore */ }
        super.onDestroy();
    }

    private void setupBackButton() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                try {
                    Bridge bridge = getBridge();
                    if (bridge != null) {
                        WebView wv = bridge.getWebView();
                        if (wv != null && wv.canGoBack()) {
                            wv.goBack();
                            return;
                        }
                    }
                } catch (Exception e) { /* ignore */ }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    private void setupEfgIntercept() {
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
            try {
                Bridge bridge = getBridge();
                if (bridge == null) return;
                WebView wv = bridge.getWebView();
                if (wv == null) return;
                wv.setWebViewClient(new BridgeWebViewClient(bridge) {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                        String url = request.getUrl().toString();
                        if (url.contains("efglobal.co.kr")
                                && (url.contains("/kim") || url.contains("bo_table=kim"))
                                && "GET".equalsIgnoreCase(request.getMethod())) {
                            WebResourceResponse r = fetchEfg(url);
                            if (r != null) return r;
                        }
                        return super.shouldInterceptRequest(view, request);
                    }
                });
            } catch (Exception e) { /* ignore */ }
        }, 500);
    }

    private WebResourceResponse fetchEfg(String url) {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestProperty("User-Agent",
                    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36");
            conn.setRequestProperty("Accept", "text/html,*/*");
            conn.setRequestProperty("Accept-Language", "ko-KR,ko;q=0.9");
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            if (conn.getResponseCode() != 200) { conn.disconnect(); return null; }

            InputStream is = conn.getInputStream();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] tmp = new byte[8192];
            int n;
            while ((n = is.read(tmp)) != -1) buf.write(tmp, 0, n);
            is.close();
            conn.disconnect();

            String html = buf.toString("UTF-8");
            if (html.contains("</body>")) {
                html = html.replace("</body>", EFG_HIDE_CSS + "</body>");
            } else if (html.contains("</BODY>")) {
                html = html.replace("</BODY>", EFG_HIDE_CSS + "</BODY>");
            } else {
                html += EFG_HIDE_CSS;
            }

            return new WebResourceResponse("text/html", "UTF-8",
                    new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) { return null; }
    }

    /** 대표 계정으로 로그인된 기기에서만 전화/SMS 감지가 동작한다. */
    private boolean isBoss() {
        String f = Prefs.get(this, "csep_is_boss", "");
        if (!f.isEmpty()) return "1".equals(f);
        return "대표".equals(Prefs.get(this, "csep_role", "none"));
    }

    private void requestNeededPermissions() {
        List<String> need = new ArrayList<>();
        // 전화/문자/통화기록은 '대표' 기기의 수신 감지에만 쓰인다.
        // 예전엔 일반 기사에게도 무조건 요청해 불필요한 민감권한 동의를 받았다.
        if (isBoss()) {
            String[] bossPerms = {
                    Manifest.permission.READ_PHONE_STATE,
                    Manifest.permission.READ_CALL_LOG,   // Android 10+ 에서 발신번호(EXTRA_INCOMING_NUMBER) 수신에 필요
                    Manifest.permission.RECEIVE_SMS,
                    Manifest.permission.READ_SMS
            };
            for (String p : bossPerms) {
                if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) need.add(p);
            }
        }
        // 음성입력(작업내용 받아쓰기)은 모든 기사가 쓴다
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            need.add(Manifest.permission.RECORD_AUDIO);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            need.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!need.isEmpty()) ActivityCompat.requestPermissions(this, need.toArray(new String[0]), 1001);
    }

    /**
     * 전화 감지 유지용 포그라운드 서비스 — 대표 기기에서만 띄운다.
     * 예전엔 모든 기사 폰에 "CSEP 실행 중" 상시 알림이 뜨고 배터리를 계속 썼다.
     */
    private void startMonitor() {
        try {
            Intent svc = new Intent(this, CallMonitorService.class);
            if (!isBoss()) { stopService(svc); return; }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc);
            else startService(svc);
        } catch (Exception e) { /* ignore */ }
    }

    @Override
    public void onResume() {
        super.onResume();
        // 로그인/로그아웃으로 역할이 바뀐 뒤 앱으로 돌아왔을 때 서비스·권한 상태를 맞춘다.
        startMonitor();
        requestNeededPermissions();
    }
}
