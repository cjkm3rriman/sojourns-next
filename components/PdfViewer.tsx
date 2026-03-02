'use client';

interface PdfViewerProps {
  url: string;
  filename: string;
  scale: number;
}

export default function PdfViewer({ url, filename, scale }: PdfViewerProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
        }}
      >
        <iframe
          src={url}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title={filename}
        />
      </div>
    </div>
  );
}
