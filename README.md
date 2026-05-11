# Meteoverso 🌤️

Comparador meteorológico científico. Tres modelos. Un consenso.

## Despliegue en 5 minutos (Vercel + GitHub)

### Paso 1 — Sube el código a GitHub

1. Ve a **github.com** e inicia sesión (o crea cuenta gratis)
2. Pulsa **"New repository"** (botón verde)
3. Nombre: `meteoverso` · Público · Sin README
4. Pulsa **"Create repository"**
5. En tu ordenador, descarga esta carpeta `meteoverso`
6. Abre una terminal en esa carpeta y ejecuta:

```bash
git init
git add .
git commit -m "Meteoverso inicial"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/meteoverso.git
git push -u origin main
```

### Paso 2 — Despliega en Vercel

1. Ve a **vercel.com** e inicia sesión con tu cuenta de GitHub
2. Pulsa **"Add New Project"**
3. Selecciona el repositorio `meteoverso`
4. Vercel detecta Vite automáticamente — pulsa **"Deploy"**
5. En 2 minutos tendrás tu URL: `meteoverso.vercel.app`

### Desarrollo local

```bash
npm install
npm run dev
```

Abre http://localhost:5173

## Stack

- React + Vite
- Open-Meteo API (gratuita, sin API key)
- ECMWF IFS · ICON-EU · Best Match (estaciones AEMET)
