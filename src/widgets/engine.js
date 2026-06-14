// src/widgets/engine.js
import ClockWidget from "./ClockWidget.js";
import LyricsWidget from "./LyricsWidget.js"; // Bunu da benzer şekilde oluşturabilirsin

const registry = {
    'simple_clock': new ClockWidget(),
    'live_lyrics': new LyricsWidget()
};

export async function processMatrixState(activeMode, widgetConfig, sharedData) {
    const widget = registry[activeMode];
    if (!widget) {
        return "TXT|#FF0000|Mod Bulunamadi";
    }
    return await widget.renderToESP32(widgetConfig, sharedData);
}