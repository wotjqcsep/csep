package com.csep.app.ui.call

import android.os.Bundle
import android.view.WindowManager
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.csep.app.data.api.RetrofitClient
import com.csep.app.data.model.Customer
import com.csep.app.data.model.Reception
import com.csep.app.data.model.ReceptionCreate
import com.csep.app.databinding.ActivityCallOverlayBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CallOverlayActivity : AppCompatActivity() {

    private lateinit var binding: ActivityCallOverlayBinding
    private var phone: String = ""
    private var customer: Customer? = null
    private var recentReceptions: List<Reception> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 잠금화면 위에도 표시
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        binding = ActivityCallOverlayBinding.inflate(layoutInflater)
        setContentView(binding.root)

        phone = intent.getStringExtra("phone") ?: ""
        binding.tvPhone.text = formatPhone(phone)

        val isTest = intent.getBooleanExtra("test_mode", false)
        if (isTest) loadTestData() else loadCustomerInfo()
        setupButtons()
    }

    private fun loadTestData() {
        customer = Customer(
            id = 1, name = "[테스트] 홍길동", phone = phone,
            phone2 = null, companyName = "테스트 회사", contactPerson = null,
            address = "서울시 강남구", outstandingAmount = 150000.0,
            customerType = "individual", memo = null
        )
        recentReceptions = listOf(
            Reception(id=1, customerId=1, symptom="컴퓨터 느림", status="completed",
                channel="phone", receptionPhone=phone, initialMemo=null,
                assignedEngineerId=null, receivedAt="2026-06-20T10:00:00"),
            Reception(id=2, customerId=1, symptom="화면 깜빡임", status="in_progress",
                channel="kakao", receptionPhone=null, initialMemo=null,
                assignedEngineerId=null, receivedAt="2026-06-25T14:30:00"),
        )
        updateUI()
    }

    private fun loadCustomerInfo() {
        lifecycleScope.launch {
            try {
                // 백엔드에서 고객 매칭 정보만 조회 (팝업 중복 생성 방지 — 조회 전용 엔드포인트)
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.api.lookupCustomer(phone)
                }
                if (response.isSuccessful) {
                    val callInfo = response.body()
                    customer = callInfo?.customer
                    recentReceptions = callInfo?.recentReceptions ?: emptyList()
                    updateUI()
                }
            } catch (e: Exception) {
                binding.tvCustomerName.text = "서버 연결 실패"
            }
        }
    }

    private fun updateUI() {
        val c = customer
        if (c != null) {
            binding.tvCustomerName.text = c.name
            binding.tvCustomerDetail.text = buildString {
                if (c.companyName != null) append("${c.companyName}  ")
                if (c.address != null) append("📍 ${c.address}")
            }
            if (c.outstandingAmount > 0) {
                binding.tvOutstanding.text = "미수금 ₩${String.format("%,d", c.outstandingAmount.toLong())}"
                binding.tvOutstanding.visibility = android.view.View.VISIBLE
            }

            // 최근 접수 이력
            if (recentReceptions.isNotEmpty()) {
                val historyText = recentReceptions.joinToString("\n") { r ->
                    val statusLabel = when(r.status) {
                        "new" -> "신규" ; "assigned" -> "배정" ; "in_progress" -> "진행중"
                        "completed" -> "완료" ; else -> r.status
                    }
                    "[$statusLabel] ${r.symptom}  ${r.receivedAt.take(10)}"
                }
                binding.tvHistory.text = historyText
                binding.cardHistory.visibility = android.view.View.VISIBLE
            }

            binding.btnRegister.isEnabled = true
            binding.groupForm.visibility = android.view.View.VISIBLE
        } else {
            binding.tvCustomerName.text = "신규 고객"
            binding.tvCustomerDetail.text = "등록되지 않은 번호입니다"
            binding.btnRegister.isEnabled = false
        }
    }

    private fun setupButtons() {
        binding.btnDismiss.setOnClickListener { finish() }

        binding.btnRegister.setOnClickListener {
            val symptom = binding.etSymptom.text.toString().trim()
            if (symptom.isEmpty()) {
                Toast.makeText(this, "증상을 입력하세요", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val channel = when (binding.rgChannel.checkedRadioButtonId) {
                binding.rbPhone.id -> "phone"
                binding.rbSms.id -> "sms"
                binding.rbKakao.id -> "kakao"
                else -> "phone"
            }

            val cust = customer ?: return@setOnClickListener
            lifecycleScope.launch {
                try {
                    val result = withContext(Dispatchers.IO) {
                        RetrofitClient.api.createReception(
                            ReceptionCreate(
                                customerId = cust.id,
                                symptom = symptom,
                                receptionChannel = channel,
                                receptionPhone = phone,
                                initialMemo = binding.etMemo.text.toString().ifBlank { null },
                            )
                        )
                    }
                    if (result.isSuccessful) {
                        Toast.makeText(this@CallOverlayActivity, "접수 완료!", Toast.LENGTH_SHORT).show()
                        finish()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@CallOverlayActivity, "접수 실패: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun formatPhone(phone: String): String {
        val d = phone.replace(Regex("[^0-9]"), "")
        return when (d.length) {
            11 -> "${d.substring(0,3)}-${d.substring(3,7)}-${d.substring(7)}"
            10 -> "${d.substring(0,3)}-${d.substring(3,6)}-${d.substring(6)}"
            else -> phone
        }
    }
}
