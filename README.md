# MASCHA STUDIO — PWA

Aplicación web móvil para generación visual POD con OpenAI GPT-Image-2.

## Incluye
- Prompt refinado antes de generar.
- Imagen de referencia opcional.
- Previsualización económica y modo final.
- Confirmación antes de cada llamada con costo.
- Tope mensual interno editable (predeterminado: USD 10).
- Texto publicitario superpuesto sin nueva llamada de generación.
- PWA para añadir a la pantalla de inicio del iPhone.
- Clave API solo en servidor mediante `OPENAI_API_KEY`.

## Ejecutar
1. Instala Node.js 20+.
2. Copia `.env.example` a `.env` y configura `OPENAI_API_KEY` en el entorno del servidor.
3. Instala dependencias: `npm install`
4. Exporta las variables del archivo `.env` usando el mecanismo de tu hosting.
5. Ejecuta: `npm start`

## Despliegue
Necesita un hosting HTTPS que ejecute Node.js y permita variables de entorno.
No pongas la clave de OpenAI en `public/`, JavaScript del navegador ni en el repositorio.

## Importante sobre el tope
El límite de USD 10 implementado aquí es un **guardarraíl interno de MASCHA STUDIO basado en estimaciones**. No sustituye los límites/presupuestos de facturación que configures en OpenAI Platform. El costo real de una solicitud puede variar según imagen de entrada, tokens, calidad y parámetros de API.

## Modelo
La app usa `gpt-image-2`, recomendado actualmente por OpenAI para generación y edición de imágenes.
