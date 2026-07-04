package com.csep.app.ui.customer

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.csep.app.data.api.RetrofitClient
import com.csep.app.databinding.FragmentCustomerBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CustomerFragment : Fragment() {

    private var _binding: FragmentCustomerBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentCustomerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadCustomers()
        binding.swipeRefresh.setOnRefreshListener { loadCustomers() }
    }

    private fun loadCustomers() {
        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) { RetrofitClient.api.getCustomers() }
                val customers = response.body() ?: emptyList()
                val text = customers.joinToString("\n─────────────\n") { c ->
                    val type = if (c.customerType == "business") "🏢 기업" else "👤 개인"
                    val outstanding = if (c.outstandingAmount > 0) "\n미수금 ₩${String.format("%,d", c.outstandingAmount.toLong())}" else ""
                    "$type  ${c.name}\n📞 ${formatPhone(c.phone)}${c.address?.let { "\n📍 $it" } ?: ""}$outstanding"
                }
                binding.tvCustomers.text = text.ifEmpty { "등록된 고객이 없습니다" }
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "불러오기 실패", Toast.LENGTH_SHORT).show()
            } finally {
                binding.swipeRefresh.isRefreshing = false
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

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
