import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { I18nProvider } from "./i18n";
import { applyA11y } from "./lib/a11y";
import { registrarServiceWorker } from "./lib/serviceWorker";
import "./index.css";
import "./theme-vars.css";   // <- añadir, después de index.css

// Alto contraste y escalado de texto ANTES de montar React (Tarea 8.1): son
// preferencias de accesibilidad y no pueden entrar con un parpadeo, así que se
// leen de localStorage de forma síncrona en vez de esperar a un efecto.
applyA11y();

// Service worker (8.3): además de registrarlo, deja el aviso de «hay una
// versión nueva» listo para que lo pinte `UpdatePrompt`. En desarrollo no hace
// nada, para no pelearse con el recambio en caliente de Vite.
registrarServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <App />
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
