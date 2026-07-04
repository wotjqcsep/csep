package com.csep.app.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.csep.app.R
import com.csep.app.databinding.ActivityMainBinding
import com.csep.app.service.CallMonitorService

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    private val REQUIRED_PERMISSIONS = buildList {
        add(Manifest.permission.READ_PHONE_STATE)
        add(Manifest.permission.READ_CONTACTS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }.toTypedArray()

    private val PERMISSION_REQUEST_CODE = 1001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val navHost = supportFragmentManager.findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        val navController = navHost.navController
        binding.bottomNav.setupWithNavController(navController)

        checkPermissions()
    }

    private fun checkPermissions() {
        val missing = REQUIRED_PERMISSIONS.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), PERMISSION_REQUEST_CODE)
        } else {
            checkOverlayPermission()
        }
    }

    private fun checkOverlayPermission() {
        if (!Settings.canDrawOverlays(this)) {
            AlertDialog.Builder(this)
                .setTitle("화면 위 표시 권한 필요")
                .setMessage("전화 수신 시 고객 정보 팝업을 표시하려면\n'다른 앱 위에 표시' 권한이 필요합니다.")
                .setPositiveButton("설정으로 이동") { _, _ ->
                    val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName"))
                    startActivity(intent)
                }
                .setNegativeButton("나중에") { _, _ -> }
                .show()
        } else {
            startMonitorService()
        }
    }

    private fun startMonitorService() {
        val intent = Intent(this, CallMonitorService::class.java)
        startForegroundService(intent)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val denied = permissions.zip(grantResults.toList())
                .filter { (_, result) -> result != PackageManager.PERMISSION_GRANTED }
                .map { (perm, _) -> perm }

            if (denied.isEmpty()) {
                checkOverlayPermission()
            } else {
                Toast.makeText(this, "일부 권한이 거부되었습니다.\n전화 감지 기능이 제한될 수 있습니다.", Toast.LENGTH_LONG).show()
                startMonitorService()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // 오버레이 권한 설정 후 돌아왔을 때 서비스 시작
        if (Settings.canDrawOverlays(this)) {
            startMonitorService()
        }
    }
}
