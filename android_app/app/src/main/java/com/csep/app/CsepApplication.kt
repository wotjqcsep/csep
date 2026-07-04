package com.csep.app

import android.app.Application
import com.csep.app.data.api.RetrofitClient

class CsepApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        RetrofitClient.init(this)
    }
}
