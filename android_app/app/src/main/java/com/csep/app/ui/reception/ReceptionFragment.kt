package com.csep.app.ui.reception

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.csep.app.data.api.RetrofitClient
import com.csep.app.data.model.Customer
import com.csep.app.data.model.Reception
import com.csep.app.data.model.ReceptionCreate
import com.csep.app.databinding.FragmentReceptionBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ReceptionFragment : Fragment() {

    private var _binding: FragmentReceptionBinding? = null
    private val binding get() = _binding!!
    private var customers = listOf<Customer>()
    private var receptions = listOf<Reception>()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentReceptionBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadData()
        binding.swipeRefresh.setOnRefreshListener { loadData() }
        binding.btnAdd.setOnClickListener { showAddForm() }
        binding.btnSave.setOnClickListener { saveReception() }
        binding.btnCancel.setOnClickListener { binding.formCard.visibility = View.GONE }
    }

    private fun loadData() {
        lifecycleScope.launch {
            try {
                val (custRes, recRes) = withContext(Dispatchers.IO) {
                    Pair(RetrofitClient.api.getCustomers(), RetrofitClient.api.getReceptions())
                }
                customers = custRes.body() ?: emptyList()
                receptions = recRes.body() ?: emptyList()
                updateList()
                setupCustomerSpinner()
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "불러오기 실패", Toast.LENGTH_SHORT).show()
            } finally {
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    private fun setupCustomerSpinner() {
        val names = customers.map { "${it.name} (${it.phone})" }
        binding.spinnerCustomer.adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, names)
            .also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
    }

    private fun updateList() {
        val items = receptions.joinToString("\n─────────────\n") { r ->
            val customer = customers.find { it.id == r.customerId }
            val statusLabel = when(r.status) {
                "new" -> "🟡 신규" ; "assigned" -> "🔵 배정" ; "in_progress" -> "🟠 진행중"
                "completed" -> "✅ 완료" ; else -> r.status
            }
            "$statusLabel  ${customer?.name ?: "고객${r.customerId}"}\n${r.symptom}\n${r.receivedAt.take(16).replace("T"," ")}"
        }
        binding.tvReceptions.text = items.ifEmpty { "접수 내역이 없습니다" }
    }

    private fun showAddForm() {
        binding.formCard.visibility = View.VISIBLE
        binding.etSymptom.text?.clear()
        binding.etMemo.text?.clear()
    }

    private fun saveReception() {
        val symptom = binding.etSymptom.text.toString().trim()
        if (symptom.isEmpty()) { Toast.makeText(requireContext(), "증상을 입력하세요", Toast.LENGTH_SHORT).show(); return }
        val idx = binding.spinnerCustomer.selectedItemPosition
        if (idx < 0 || idx >= customers.size) { Toast.makeText(requireContext(), "고객을 선택하세요", Toast.LENGTH_SHORT).show(); return }
        val customer = customers[idx]
        val channel = when (binding.rgChannel.checkedRadioButtonId) {
            binding.rbPhone.id -> "phone"
            binding.rbSms.id -> "sms"
            binding.rbKakao.id -> "kakao"
            else -> "phone"
        }
        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    RetrofitClient.api.createReception(ReceptionCreate(
                        customerId = customer.id,
                        symptom = symptom,
                        receptionChannel = channel,
                        receptionPhone = customer.phone,
                        initialMemo = binding.etMemo.text.toString().ifBlank { null },
                    ))
                }
                if (result.isSuccessful) {
                    Toast.makeText(requireContext(), "접수 완료!", Toast.LENGTH_SHORT).show()
                    binding.formCard.visibility = View.GONE
                    loadData()
                }
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "저장 실패", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
