package com.lacasita.connect.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF6366f1), // Accent Indigo
    secondary = Color(0xFF1e293b), // BG Secondary
    tertiary = Color(0xFF22c55e),  // Success Green
    background = Color(0xFF0f172a), // BG Primary
    surface = Color(0xFF1e293b),
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = Color(0xFFf8fafc),
    onSurface = Color(0xFFf8fafc),
)

@Composable
fun LaCasitaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else DarkColorScheme // Force dark for premium look
    
    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
