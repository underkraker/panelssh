package com.lacasita.connect.data.model

import com.google.gson.annotations.SerializedName

data class LoginResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("error") val error: String? = null
)

data class ConfigResponse(
    @SerializedName("username") val username: String,
    @SerializedName("expiry_date") val expiryDate: String,
    @SerializedName("domain") val domain: String,
    @SerializedName("services") val services: List<ServiceConfig>,
    @SerializedName("payload") val payload: String
)

data class ServiceConfig(
    @SerializedName("name") val name: String,
    @SerializedName("port") val port: Int
)
