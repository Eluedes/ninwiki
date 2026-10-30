'use client';

/**
 * Summary: mapa vetorial do mundo com pontos de interesse interativos.
 *
 * A base é um SVG desenhado a partir da composição visual do mapa enviado:
 * oceano, regiões coloridas, ilhas, rotas e nós de navegação. Os pins HTML
 * ficam separados do desenho para continuarem acessíveis e fáceis de trocar
 * quando os locais vierem do back-end.
 */

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { PageHeader } from '@/components/lore/page-header';
import { mapMarkers } from '@/lib/map-data';
import { villages } from '@/lib/village-data';
import { elementLabel, localizedText } from '@/lib/localized';
import { useLanguage } from '@/components/providers/language-provider';

const routeNodes = [
  [18, 324, '#f59e0b'],
  [42, 328, '#ef4444'],
  [67, 337, '#facc15'],
  [95, 318, '#22c55e'],
  [125, 331, '#ef4444'],
  [153, 314, '#f59e0b'],
  [185, 345, '#38bdf8'],
  [216, 328, '#facc15'],
  [244, 341, '#ef4444'],
  [270, 310, '#22c55e'],
  [299, 323, '#f59e0b'],
  [325, 302, '#38bdf8'],
  [354, 321, '#facc15'],
  [384, 296, '#ef4444'],
  [415, 310, '#22c55e'],
  [447, 296, '#f59e0b'],
  [480, 314, '#38bdf8'],
  [512, 293, '#facc15'],
  [545, 306, '#ef4444'],
  [574, 284, '#22c55e'],
  [604, 300, '#f59e0b'],
  [124, 203, '#ef4444'],
  [143, 235, '#f59e0b'],
  [175, 219, '#22c55e'],
  [195, 244, '#38bdf8'],
  [222, 231, '#facc15'],
  [253, 245, '#ef4444'],
  [286, 217, '#22c55e'],
  [322, 207, '#ef4444'],
  [348, 229, '#f59e0b'],
  [373, 253, '#38bdf8'],
  [403, 242, '#facc15'],
  [432, 267, '#22c55e'],
  [462, 245, '#ef4444'],
  [494, 272, '#f59e0b'],
  [523, 252, '#38bdf8'],
  [551, 266, '#facc15'],
  [584, 251, '#ef4444'],
  [610, 269, '#22c55e'],
] as const;

/** Mapa do jogo (ainda com marcadores de exemplo). */
export default function MapPage() {
  const { locale, dict } = useLanguage();
  const t = dict.lore;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 animate-fade-in">
      <PageHeader
        title={t.mapTitle}
        subtitle={t.mapSubtitle}
        breadcrumbs={[{ label: t.home, href: '/' }, { label: t.mapCrumb }]}
        icon={<MapPin className="h-7 w-7" />}
      />

      {/* SVG vetorial com a mesma proporção geral do mapa de referência. */}
      <div className="dossier-panel relative aspect-[640/411] w-full overflow-hidden">
        <svg
          viewBox="0 0 640 411"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          aria-label={t.mapAria}
          role="img"
        >
          <defs>
            <pattern id="ocean-waves" width="72" height="42" patternUnits="userSpaceOnUse">
              <path
                d="M4 15 Q14 27 24 15 Q34 3 44 15 Q54 27 64 15"
                fill="none"
                stroke="#466c78"
                strokeWidth="1.4"
                opacity="0.62"
              />
            </pattern>
            <filter id="map-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodColor="#2d2930" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Oceano e textura de ondas. */}
          <rect width="640" height="411" fill="#78979d" />
          <rect width="640" height="411" fill="url(#ocean-waves)" opacity="0.72" />

          {/* Região noroeste arroxeada. */}
          <path
            d="M0 0 H161 C177 22 168 42 175 61 C184 85 173 108 158 123 C142 138 143 157 160 172 C176 186 167 201 146 208 C121 217 108 202 87 208 C54 217 30 206 0 210 Z"
            fill="#a47d82"
            stroke="#5f5149"
            strokeWidth="3"
            strokeLinejoin="round"
            filter="url(#map-shadow)"
          />

          {/* Região nordeste dourada. */}
          <path
            d="M486 0 H640 V174 C624 183 610 173 595 180 C575 190 552 179 540 164 C524 145 508 139 492 122 C476 105 466 91 474 72 C482 53 478 25 486 0 Z"
            fill="#c4a34d"
            stroke="#66543d"
            strokeWidth="3"
            strokeLinejoin="round"
            filter="url(#map-shadow)"
          />

          {/* Faixa de terras altas no centro-norte. */}
          <path
            d="M245 0 C256 22 278 27 295 43 C311 58 309 72 296 83 C284 93 286 107 300 117 C313 128 306 143 289 147 C271 151 263 143 249 151 C232 161 214 151 208 136 C201 119 211 104 225 94 C238 84 234 69 222 57 C209 45 212 25 226 17 C235 12 241 7 245 0 Z"
            fill="#b5a87a"
            stroke="#665847"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M316 111 C334 105 352 111 362 126 C371 139 386 139 397 132 C410 124 423 133 426 149 C429 164 418 178 405 185 C391 193 386 208 370 211 C350 214 340 200 328 191 C313 180 299 178 289 166 C278 153 285 136 298 129 C308 124 310 116 316 111 Z"
            fill="#c3b789"
            stroke="#665847"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Grande massa verde do sudoeste. */}
          <path
            d="M0 181 C19 176 35 184 51 177 C67 170 82 177 94 190 C108 205 126 199 142 207 C158 215 166 231 157 247 C149 261 132 268 124 281 C114 297 122 315 107 327 C92 340 77 332 64 342 C47 355 29 347 17 360 C10 367 5 370 0 371 Z"
            fill="#7f8c6d"
            stroke="#5d5847"
            strokeWidth="3"
            strokeLinejoin="round"
            filter="url(#map-shadow)"
          />

          {/* Região avermelhada central. */}
          <path
            d="M157 205 C176 193 194 198 211 207 C227 216 244 208 258 217 C273 227 273 243 289 250 C302 256 309 273 302 288 C294 305 278 310 264 318 C246 328 224 320 208 327 C190 335 176 325 165 312 C155 300 143 292 146 276 C149 260 139 247 143 231 C146 220 151 213 157 205 Z"
            fill="#a76365"
            stroke="#634e45"
            strokeWidth="3"
            strokeLinejoin="round"
            filter="url(#map-shadow)"
          />

          {/* Terras de transição no centro e sudeste. */}
          <path
            d="M302 184 C322 176 341 183 352 195 C364 209 380 208 394 217 C409 226 418 243 411 258 C405 273 386 278 373 286 C357 296 342 291 327 299 C311 308 295 299 289 286 C282 272 288 258 299 249 C309 240 295 226 291 214 C287 202 291 190 302 184 Z"
            fill="#a8906d"
            stroke="#625443"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M415 170 C432 163 447 172 456 187 C466 203 482 203 494 215 C506 227 504 243 494 254 C482 267 465 269 451 278 C436 286 422 279 414 266 C407 255 409 242 418 232 C427 221 411 210 406 199 C401 188 405 176 415 170 Z"
            fill="#b6a36f"
            stroke="#625443"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Ilhas e bancos rochosos do leste. */}
          <path d="M522 188 C536 179 553 184 558 195 C562 206 552 215 541 219 C528 224 516 217 514 206 C512 198 516 192 522 188 Z" fill="#b8a47a" stroke="#665847" strokeWidth="3" />
          <path d="M482 263 C492 254 506 256 510 266 C514 277 506 287 496 290 C485 294 475 286 475 277 C475 271 478 267 482 263 Z" fill="#bdad81" stroke="#665847" strokeWidth="3" />
          <path d="M555 320 C569 312 586 318 590 331 C593 343 582 354 569 356 C555 358 545 347 546 336 C547 330 550 324 555 320 Z" fill="#bcae83" stroke="#665847" strokeWidth="3" />
          <path d="M611 224 C622 217 635 222 640 233 V263 C630 267 619 263 614 253 C609 243 604 231 611 224 Z" fill="#bcae83" stroke="#665847" strokeWidth="3" />

          {/* Rotas principais, desenhadas como a rede da imagem de referência. */}
          <g fill="none" stroke="#68422e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
            <path d="M0 326 C46 319 83 331 122 324 C157 318 180 343 214 332 C243 323 267 337 299 318 C328 300 348 322 380 301 C413 280 434 316 466 299 C499 281 523 301 552 286 C584 270 613 280 640 266" />
            <path d="M124 203 C133 221 143 235 164 236 C185 236 190 253 210 252 C229 251 240 233 260 237 C279 240 286 222 302 213 C318 204 324 216 337 226 C353 240 366 252 383 254 C403 257 415 242 432 243 C448 244 459 258 475 266" />
            <path d="M72 365 C90 350 94 331 108 315 C124 298 142 303 157 286 C170 272 163 252 177 241" />
            <path d="M295 315 C312 298 325 282 342 276 C361 269 375 278 387 292 C401 307 415 315 435 308 C453 301 466 311 481 323" />
            <path d="M510 292 C527 275 543 268 559 275 C574 282 586 296 604 299 C618 301 629 294 640 287" />
          </g>

          {/* Nós decorativos do SVG; os pins interativos ficam por cima deles. */}
          <g>
            {routeNodes.map(([cx, cy, color], index) => (
              <circle
                key={index}
                cx={cx}
                cy={cy}
                r="3.4"
                fill={color}
                stroke="#332821"
                strokeWidth="1.4"
              />
            ))}
          </g>

          {/* Nuvens estilizadas presentes no mapa de referência. */}
          <g fill="none" stroke="#f4eee0" strokeWidth="5" strokeLinecap="round" opacity="0.9">
            <path d="M24 28 C10 36 17 50 33 49 C44 48 46 39 38 35 C31 31 27 35 24 39" />
            <path d="M554 379 C567 367 579 373 576 383 C572 393 558 390 558 382 C558 374 572 371 580 380" />
            <path d="M618 143 C628 136 637 140 636 148 C634 156 623 153 624 147 C626 140 636 141 640 146" />
          </g>
        </svg>

        {/* Pins compactos inspirados nos nós da imagem. Os nomes aparecem
            somente no box para manter o mapa limpo e interativo. */}
        <div className="absolute inset-0">
          {mapMarkers.map((marker) => (
            <button
              key={marker.id}
              type="button"
              aria-label={t.mapMarkerAria.replace('{title}', localizedText(locale, marker.title, marker.titlePt))}
              className="group absolute -translate-x-1/2 -translate-y-1/2 outline-none"
              style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
            >
              <span className="relative block h-3 w-3 rounded-full border border-white/90 bg-slate-950 shadow-[0_0_0_1px_rgba(0,0,0,0.75)] transition-transform duration-150 group-hover:scale-150 group-focus:scale-150">
                <span
                  className="absolute inset-[2px] rounded-full"
                  style={{ backgroundColor: marker.color }}
                />
              </span>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-md border border-white/15 bg-slate-950/95 px-3 py-2 text-left opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
                <strong className="block text-sm font-semibold text-white">{localizedText(locale, marker.title, marker.titlePt)}</strong>
                <span className="mt-1 block text-xs leading-relaxed text-slate-300">
                  {localizedText(locale, marker.description, marker.descriptionPt)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-center text-sm text-ink-400">
        {t.mapHint}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {villages.map((village) => (
          <Link
            key={village.id}
            href={`/village/${village.id}`}
            className="dossier-panel dossier-panel-hover flex items-center gap-3 p-3"
          >
            <span className="text-2xl">{village.emblem}</span>
            <div>
              <p className="text-sm font-semibold text-ink-100">{locale === 'pt' ? village.name : village.englishName}</p>
              <p className="text-xs text-ink-400">{elementLabel(locale, village.element)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}