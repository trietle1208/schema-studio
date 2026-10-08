import { useEffect, useMemo, useState } from 'react';
import monoRegular from '../../design-system/fonts/GeistMono-Regular.woff2?url';
import monoSemiBold from '../../design-system/fonts/GeistMono-SemiBold.woff2?url';
import { generateDiagram, imageScale, type Diagram, type DiagramColors } from '../core/generate/diagram';
import { GROUP_COLORS } from '../core/groups';
import type { GroupColor, SchemaSnapshot } from '../core/model';
import type { Theme } from '../core/theme';
import type { DiagramImage } from './exportActions';

// The diagram as a picture: what the Export Schema dialog needs of the browser to draw it. The
// picture itself is written in core/generate/diagram.

/** The colours of a theme, read from the tokens of the styles. */
export function diagramColors(theme: Theme): DiagramColors {
  // The tokens of a theme hold on any element that names it, whatever the app is painted in.
  const probe = document.createElement('div');
  probe.dataset.theme = theme;
  probe.hidden = true;
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const token = (name: string) => style.getPropertyValue(`--${name}`).trim();
  const colors: DiagramColors = {
    background: token('bg-1'),
    node: token('bg-3'),
    nodeBorder: token('line-2'),
    rule: token('line-1'),
    ink1: token('ink-1'),
    ink2: token('ink-2'),
    ink3: token('ink-3'),
    pk: token('pk'),
    fk: token('fk'),
    relation: token('relation'),
    invalid: token('removed'),
    groups: Object.fromEntries(GROUP_COLORS.map((color) => [color, token(`group-${color}`)])) as Record<GroupColor, string>,
  };
  probe.remove();
  return colors;
}

async function embedded(url: string, weight: number): Promise<string> {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `@font-face{font-family:'Geist Mono';font-weight:${weight};src:url(data:font/woff2;base64,${btoa(binary)}) format('woff2')}`;
}

let fonts: Promise<string> | null = null;

/**
 * `@font-face` rules with the two weights of the mono face a diagram is written in, the files in
 * them: a picture is drawn apart from the page and has no other way to its fonts. Read once.
 * Empty when the files cannot be read; the picture is then written in the mono face of the system.
 */
export function diagramFonts(): Promise<string> {
  fonts ??= Promise.all([embedded(monoRegular, 400), embedded(monoSemiBold, 600)])
    .then((rules) => rules.join(''))
    .catch((error) => {
      console.error(error);
      return '';
    });
  return fonts;
}

/** Draws the SVG of a diagram of `width` by `height` as a PNG at `scale`. Rejects when the browser cannot. */
export async function renderPng(svg: string, width: number, height: number, scale: number): Promise<DiagramImage> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D context for the diagram.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const file = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!file) throw new Error('The diagram could not be drawn as a PNG.');
    return { file, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface DiagramExportOptions {
  theme: Theme;
  /** Leaves out the colour of the canvas behind the tables. */
  transparent: boolean;
  /** An SVG file brings the mono face with it. A PNG is always drawn in it. */
  embedFonts: boolean;
  /** How many px of a PNG a unit of the canvas is. */
  scale: number;
}

export interface DiagramExport {
  /** The picture as the dialog shows it; null until the fonts are read. */
  preview: Diagram | null;
  /** The SVG file. */
  file: string;
  /** The scale a PNG is drawn at: the one that is asked for, or less for a diagram that is too large for it. */
  scale: number;
  /** The size of a PNG in px. */
  pixels: { width: number; height: number };
  /** Draws the PNG. */
  png: () => Promise<DiagramImage>;
}

/**
 * The diagram of `snapshot` as the Export Schema dialog exports it with `options`. Nothing is read
 * or drawn until it is `wanted`, which it is not while the dialog is set to SQL or JSON.
 */
export function useDiagramExport(snapshot: SchemaSnapshot, options: DiagramExportOptions, wanted: boolean): DiagramExport | null {
  const [fontCss, setFontCss] = useState<string | null>(null);
  useEffect(() => {
    if (!wanted) return;
    let current = true;
    void diagramFonts().then((css) => {
      if (current) setFontCss(css);
    });
    return () => {
      current = false;
    };
  }, [wanted]);

  const { theme, transparent, embedFonts } = options;
  const colors = useMemo(() => (wanted ? diagramColors(theme) : null), [wanted, theme]);
  const plain = useMemo(
    () => colors && generateDiagram(snapshot, colors, { background: !transparent }),
    [snapshot, colors, transparent],
  );
  const drawn = useMemo(() => {
    if (!colors || fontCss === null) return null;
    return fontCss ? generateDiagram(snapshot, colors, { background: !transparent, fontCss }) : plain;
  }, [snapshot, colors, transparent, fontCss, plain]);
  if (!colors || !plain) return null;
  const scale = imageScale(plain.width, plain.height, options.scale);
  return {
    preview: drawn,
    file: embedFonts && drawn ? drawn.svg : plain.svg,
    scale,
    pixels: { width: Math.round(plain.width * scale), height: Math.round(plain.height * scale) },
    png: async () => {
      const css = await diagramFonts();
      const { svg, width, height } = css ? generateDiagram(snapshot, colors, { background: !transparent, fontCss: css }) : plain;
      return renderPng(svg, width, height, scale);
    },
  };
}
