package com.csep.engineer;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

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
            + ".header-wrap,.page-header-wrap,.page-title-wrap,.ebs-shop020-tb-wrap,.top-header{display:none!important}"
            + "header,.footer,footer,#ft,.ft_wrap,.eb-backtotop,.navbar-mobile-toggler{display:none!important}"
            + ".wr_name,.td_name,.sv_member,.bo_sch_wrap,.bo_cate_list,.board-info{display:none!important}"
            + ".wr_date,.td_datetime{display:none!important}"
            + "body,.wrapper{padding-top:0!important;margin:0!important}"
            + ".page-body{padding-top:0!important;margin-top:0!important}"
            + "</style>";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestNeededPermissions();
        startMonitor();
        setupEfgIntercept();
    }

    private void setupEfgIntercept() {
        try {
            Bridge bridge = getBridge();
            WebView wv = bridge.getWebView();
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

    private void requestNeededPermissions() {
        List<String> need = new ArrayList<>();
        String[] perms = {
                Manifest.permission.READ_PHONE_STATE,
                Manifest.permission.READ_CALL_LOG,
                Manifest.permission.RECEIVE_SMS,
                Manifest.permission.READ_SMS,
                Manifest.permission.RECORD_AUDIO
        };
        for (String p : perms) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) need.add(p);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            need.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!need.isEmpty()) ActivityCompat.requestPermissions(this, need.toArray(new String[0]), 1001);
    }

    private void startMonitor() {
        try {
            Intent svc = new Intent(this, CallMonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(svc);
            else startService(svc);
        } catch (Exception e) { /* ignore */ }
    }
}
