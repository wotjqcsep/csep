package com.csep.app.ui.settings

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.csep.app.data.api.RetrofitClient
import com.csep.app.databinding.FragmentSettingsBinding
import com.csep.app.ui.call.CallOverlayActivity

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // 현재 서버 주소 표시
        binding.etServerUrl.setText(RetrofitClient.getUrl(requireContext()))

        binding.btnSaveUrl.setOnClickListener {
            val url = binding.etServerUrl.text.toString().trim()
            if (url.isEmpty()) {
                Toast.makeText(requireContext(), "서버 주소를 입력하세요", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            RetrofitClient.updateUrl(requireContext(), url)
            Toast.makeText(requireContext(), "서버 주소가 저장되었습니다", Toast.LENGTH_SHORT).show()
        }

        // 무시 그룹 안내
        binding.tvIgnoreGroupInfo.text =
            "아래 연락처 그룹에 속한 번호는 전화가 와도 팝업이 뜨지 않습니다.\n" +
            "• 가족\n• 친구\n• Starred (별표)\n\n" +
            "'업무' 그룹이거나 그룹이 없는 번호만 팝업이 표시됩니다."

        // 테스트 버튼
        binding.btnTestCall.setOnClickListener {
            val phone = binding.etTestPhone.text.toString().trim().ifEmpty { "01012345678" }
            startActivity(
                Intent(requireContext(), CallOverlayActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    putExtra("phone", phone)
                    putExtra("test_mode", true)
                }
            )
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
