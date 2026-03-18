package com.lacasita.connect.data

import com.lacasita.connect.data.model.ConfigResponse
import com.lacasita.connect.data.model.LoginResponse
import com.lacasita.connect.data.model.LoginRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface ApiService {
    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("api/users/me/config")
    suspend fun getConfig(): ConfigResponse
}
