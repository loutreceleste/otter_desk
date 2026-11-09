// Géométrie de la fenêtre partagée entre le processus principal et le renderer.
// Toutes les valeurs « Pt » sont des points macOS (indépendants de la résolution / Retina).

/** Zoom appliqué au contenu web (main : webContents.setZoomFactor). */
export const APP_ZOOM_FACTOR = 1.25;

/**
 * Boutons natifs macOS (rouge / jaune / vert), mesurés sous macOS 26 :
 * 14 × 14 pt, pas de 23 pt → groupe de 60 pt de large.
 */
const TRAFFIC_LIGHT_SIZE_PT = 14;
const TRAFFIC_LIGHTS_WIDTH_PT = 60;
const TRAFFIC_LIGHTS_X_PT = 14;

/** Hauteur de la barre de titre macOS. */
const MAC_TITLEBAR_HEIGHT_PT = 40;
/** Espace entre le bouton vert et le titre « OtterDesk ». */
const MAC_TITLE_GAP_PT = 18;

/** Position des boutons natifs : centrés verticalement dans la barre. */
export const MAC_TRAFFIC_LIGHT_POSITION = {
  x: TRAFFIC_LIGHTS_X_PT,
  y: Math.round((MAC_TITLEBAR_HEIGHT_PT - TRAFFIC_LIGHT_SIZE_PT) / 2),
};

/** Dimensions CSS de la barre (px CSS = pt / zoom, le contenu web étant zoomé). */
export const MAC_TITLEBAR_CSS = {
  heightPx: MAC_TITLEBAR_HEIGHT_PT / APP_ZOOM_FACTOR,
  paddingLeftPx: (TRAFFIC_LIGHTS_X_PT + TRAFFIC_LIGHTS_WIDTH_PT + MAC_TITLE_GAP_PT) / APP_ZOOM_FACTOR,
};
