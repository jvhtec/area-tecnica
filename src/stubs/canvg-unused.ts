/** jsPDF's unused SVG rasterizer. Actual app rasterization uses html2canvas-pro. */
const canvgUnused = {
  fromString(): never {
    throw new Error(
      "jsPDF.addSvgAsImage is not enabled. Remove the canvg alias in vite.config.ts before using it.",
    );
  },
};

export default canvgUnused;
