package com.csep.engineer;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONObject;

import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 웹(Capacitor Preferences)이 저장한 값을 네이티브에서 읽는 공용 헬퍼.
 *
 * - csep_is_boss : "1"/"0"  대표 여부 (한글 리터럴 인코딩에 의존하지 않는 판정용)
 * - csep_role    : "대표"/"기사"  (구버전 호환)
 * - csep_token   : 로그인 토큰. 2026-08-11 서버 전역 인증 도입 이후
 *                  이 토큰이 없으면 /incoming-call, /incoming-sms 가 401로 버려진다.
 * - csep_device_key : (선택) 서버 CSEP_DEVICE_KEY 와 맞춘 기기 공유키. 토큰 만료 대비 폴백.
 */
public final class Prefs {
    private static final String TAG = "CsepPrefs";
    private static final String STORE = "CapacitorStorage";

    private Prefs() {}

    public static String get(Context ctx, String key, String def) {
        try {
            SharedPreferences sp = ctx.getSharedPreferences(STORE, Context.MODE_PRIVATE);
            String v = sp.getString(key, def);
            return v == null ? def : v;
        } catch (Exception e) { return def; }
    }

    /** 인증 헤더 부착 — 토큰이 있으면 Bearer, 기기키가 있으면 x-csep-key 도 함께 보낸다. */
    public static void auth(HttpURLConnection c, String token) {
        if (token != null && !token.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + token);
    }

    public static void auth(Context ctx, HttpURLConnection c) {
        auth(c, get(ctx, "csep_token", ""));
        String dk = get(ctx, "csep_device_key", "");
        if (!dk.isEmpty()) c.setRequestProperty("x-csep-key", dk);
    }

    /**
     * 서버 로그로 실패를 남긴다(/api/logs 는 인증 없이 POST 허용).
     * adb 없이도 PC에서 원인을 확인할 수 있게 하기 위함.
     */
    public static void remoteLog(final String api, final String tag, final String message) {
        new Thread(new Runnable() {
            public void run() {
                try {
                    JSONObject b = new JSONObject();
                    b.put("platform", "android");
                    b.put("level", "error");
                    b.put("tag", tag);
                    b.put("message", message == null ? "" : message);
                    HttpURLConnection c = (HttpURLConnection) new URL(api + "/logs").openConnection();
                    c.setRequestMethod("POST");
                    c.setRequestProperty("Content-Type", "application/json");
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(8000);
                    c.setDoOutput(true);
                    c.getOutputStream().write(b.toString().getBytes("UTF-8"));
                    c.getResponseCode();
                    c.disconnect();
                } catch (Exception e) { Log.w(TAG, "remoteLog fail: " + e.getMessage()); }
            }
        }).start();
    }
}
