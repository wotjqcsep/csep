package com.csep.engineer;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        // 대표 기기에서만 전화 감지 서비스를 살린다 (일반 기사 폰엔 상시 알림이 뜨지 않도록)
        String f = Prefs.get(context, "csep_is_boss", "");
        boolean boss = !f.isEmpty() ? "1".equals(f) : "대표".equals(Prefs.get(context, "csep_role", "none"));
        if (!boss) return;
        try {
            Intent svc = new Intent(context, CallMonitorService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(svc);
            else context.startService(svc);
        } catch (Exception e) { /* 부팅 직후 FGS 시작 제한 시 무시 */ }
    }
}
