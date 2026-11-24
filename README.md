# Buensoft Trivia

Aplicación web de trivia competitiva y aprendizaje educativo con **Modo SOLO**, **Modo Multijugador en tiempo real**, **Panel Administrativo JSON** y **Estadísticas independientes**.

Comparte el banco de preguntas (`public.subjects`, `public.questions`) y los perfiles (`public.students`) con **Buensoft Evalua** en Supabase (`fminldhflehobacskjfp.supabase.co`), almacenando toda la información de Trivia en nuevas tablas con prefijo `trivia_*` sin alterar Buensoft Evalua.

## Instalación y puesta en marcha

### 1. Crear tablas y funciones RPC en Supabase (una sola vez)
1. Abre el **SQL Editor** de tu proyecto Supabase (`fminldhflehobacskjfp`).
2. Pega y ejecuta el contenido completo de `supabase/001_trivia_schema.sql`.

### 2. Ejecutar en local
```bash
npm install
npm run dev
```
Abre `http://localhost:5174` en tu navegador.

### 3. Pruebas y compilación de producción
```bash
npm test
npm run build
```

## Funcionalidades incluidas
- **Selección de modalidad**: MODO SOLO y MODO MULTIJUGADOR tras iniciar sesión con un perfil de `public.students`.
- **MODO SOLO (vs PC)** (sin dependencia de Realtime):
  - Simula una partida multijugador eligiendo de 1 a 5 personajes ficticios de la PC (de nivel bajo a experto: Tito el Curioso, Lina la Exploradora, Mateo el Estratega, Valeria la Erudita y Dr. Kronos IA) con marcador en vivo y podio final.
  - Configuración de rondas (`3, 5, 6, 10`), preguntas por ronda (`5, 10, 15`), tiempo (`5, 10, 15, 20s`), categorías, dificultad y comodines (`50/50`, `+10s`, `x2 Puntos`, `Saltar`).
  - **Modo Práctica** sin límite de tiempo ni presión de puntuación.
  - Puntuación progresiva por ronda (`100, 200, 300, 400, 500, 1,000+`), multiplicadores, rachas, récords y logros.
  - Explicación educativa tras cada pregunta, resumen final y botón **Practicar incorrectas**.
- **MODO MULTIJUGADOR**:
  - Creación de salas con código de 6 caracteres, lobby con estado "Listo", rondas sincronizadas con Supabase Realtime, comodines, marcador en vivo y registro de remontadas.
- **Panel Administrativo JSON**:
  - Importación multi-archivo `.json` / `.md` con adaptador para el formato de Buensoft Evalua (`opciones[0]` como correcta) y formatos alternativos (`respuesta_correcta`, inglés, agrupado).
  - Validación, detección de duplicados, vista previa de válidas vs rechazadas, edición, eliminación y exportación a JSON.
- **Estadísticas independientes**:
  - Pestañas separadas para **General Combinado**, **Modo SOLO** (récords, fortalezas y áreas a mejorar por categoría, logros) y **Modo Multijugador** (victorias, % victorias, posiciones y remontadas).
