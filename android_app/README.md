# 🏠 La Casita Connect — Guía de Desarrollo

Esta es la aplicación oficial para clientes de **La Casita Panel**. Permite a los usuarios conectarse a tus servidores de forma rápida y sencilla.

## 🚀 Requisitos para Compilar
1.  **Android Studio** (Version Koala o superior).
2.  **JDK 17**.
3.  **Gradle** (configurado automáticamente por Android Studio).

## 📁 Estructura del Código
*   `MainActivity.kt`: Punto de entrada y navegación (Login -> Dashboard).
*   `data/ApiService.kt`: Comunicación con tu Panel Node.js.
*   `ui/theme/Theme.kt`: Colores y estilos premium del panel.

## 🛠️ Cómo Probar la App
1.  Importa la carpeta `android_app` en Android Studio.
2.  En `ApiService.kt`, asegúrate de que la `BASE_URL` apunte a la IP o dominio de tu panel.
3.  Compila y genera el APK desde `Build > Build Bundle(s) / APK(s) > Build APK(s)`.

## 🔒 Seguridad
La App utiliza autenticación basada en sesiones y se comunica de forma cifrada con el panel. En futuras actualizaciones, añadiremos soporte para certificados SSL personalizados dentro de la App.

---
© 2026 La Casita Panel Team
