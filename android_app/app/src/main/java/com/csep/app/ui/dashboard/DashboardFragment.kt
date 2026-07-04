package com.csep.app.ui.dashboard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.csep.app.data.api.RetrofitClient
import com.csep.app.databinding.FragmentDashboardBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DashboardFragment : Fragment() {

    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadDashboard()
        binding.swipeRefresh.setOnRefreshListener { loadDashboard() }
    }

    private fun loadDashboard() {
        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) { RetrofitClient.api.getDashboard() }
                if (response.isSuccessful) {
                    val d = response.body() ?: return@launch
                    binding.tvTodayNew.text = d.todayNew.toString()
                    binding.tvInProgress.text = d.inProgress.toString()
                    binding.tvAssigned.text = d.assignedPending.toString()
                    binding.tvCompleted.text = d.completedToday.toString()
                    binding.tvOutstanding.text = "₩${String.format("%,d", d.totalOutstanding.toLong())}"

                    val engineerText = d.engineers.joinToString("\n") { e ->
                        val statusLabel = when(e.status) {
                            "idle" -> "대기" ; "working" -> "작업중" ; "on_the_way" -> "출동중" ; else -> "퇴근"
                        }
                        "${e.name}  [$statusLabel]  ${e.location ?: ""}"
                    }
                    binding.tvEngineers.text = engineerText
                }
            } catch (e: Exception) {
                binding.tvTodayNew.text = "-"
            } finally {
                binding.swipeRefresh.isRefreshing = false
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
