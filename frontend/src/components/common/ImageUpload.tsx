import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { UploadSimple, X, Camera, WarningCircle } from '@phosphor-icons/react';
import api from '../../services/api/axios';

interface ImageUploadProps {
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  type?: 'brands' | 'products' | 'temp' | 'receipts';
  multiple?: boolean;
  maxFiles?: number;
  accept?: string;
  className?: string;
  showPreview?: boolean;
  previewSize?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Botón pequeño en vez del dropzone completo — para formularios angostos (ej. línea de pago). */
  compact?: boolean;
}

const ImageUpload = ({
  value = '',
  onChange,
  type = 'temp', // 'brands', 'products', 'temp'
  multiple = false,
  maxFiles = 5,
  accept = 'image/*',
  className = '',
  showPreview = true,
  previewSize = 'w-32 h-32', // Tailwind classes for preview size
  placeholder = 'Click para subir imagen',
  disabled = false,
  compact = false,
}: ImageUploadProps): React.JSX.Element => {
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get base URL for images (API URL without /api suffix)
  const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api$/, '') || window.location.origin;

  const handleFileSelect = async (files: File[]): Promise<void> => {
    if (!files || files.length === 0) return;

    // Validar número de archivos
    if (multiple && files.length > maxFiles) {
      setError(`Solo puedes subir máximo ${maxFiles} archivos`);
      return;
    }

    setError('');
    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('image', files[0]);
      formData.append('type', type);

      // Si es múltiple, procesar cada archivo
      if (multiple) {
        const uploadedUrls = [];
        for (let i = 0; i < files.length; i++) {
          const singleFormData = new FormData();
          singleFormData.append('image', files[i]);
          singleFormData.append('type', type);
          
          const response = await api.post('/upload', singleFormData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                ((progressEvent.loaded * 100) / (progressEvent.total ?? 1)) / files.length +
                (i * 100) / files.length
              );
              setUploadProgress(percentCompleted);
            }
          });
          
          uploadedUrls.push(response.data.data.url);
        }
        
        onChange(uploadedUrls);
      } else {
        // Subir un solo archivo
        const response = await api.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total ?? 1)
            );
            setUploadProgress(percentCompleted);
          }
        });
        
        const imageUrl = response.data.data.url;
        onChange(imageUrl);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al subir la imagen');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files || []);
    handleFileSelect(files);
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      handleFileSelect(files);
    }
  };

  const removeImage = () => {
    onChange('');
    setError('');
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  // Para múltiples imágenes
  const removeImageAtIndex = (index: number) => {
    const newUrls = Array.isArray(value) ? [...value] : [];
    newUrls.splice(index, 1);
    onChange(newUrls);
  };

  const renderPreview = (url: string, index: number | null = null) => {
    // Ensure URL has the base server URL
    let fullUrl = url;
    if (url && !url.startsWith('http') && !url.startsWith('data:')) {
      fullUrl = `${baseUrl}${url}`;
    }

    const isFullWidth = previewSize.includes('w-full');

    return (
      <div key={index || 'preview'} className={`relative group${isFullWidth ? ' w-full' : ''}`}>
        <img
          src={fullUrl}
          alt="Preview"
          className={`${previewSize} object-contain object-center rounded-lg border-2 border-gray-200`}
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => index !== null ? removeImageAtIndex(index) : removeImage()}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  if (compact) {
    const singleValue = Array.isArray(value) ? value[0] : value;
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />
        {singleValue ? (
          <>
            <a
              href={singleValue.startsWith('http') ? singleValue : `${baseUrl}${singleValue}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5"
            >
              <Camera className="h-3.5 w-3.5" /> Comprobante adjunto
            </a>
            {!disabled && (
              <button type="button" onClick={removeImage} className="text-red-500 hover:text-red-700">
                <X className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled || uploading}
            className="flex items-center gap-1 text-xs text-gray-600 bg-white border border-gray-300 rounded px-2 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            <Camera className="h-3.5 w-3.5" /> {uploading ? `Subiendo ${uploadProgress}%` : 'Adjuntar foto'}
          </button>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {/* Vista previa */}
      {showPreview && value && (
        <div className={`flex flex-wrap gap-2${previewSize.includes('w-full') ? ' w-full' : ' justify-center'}`}>
          {Array.isArray(value) ? (
            value.map((url: string, index: number) => renderPreview(url, index))
          ) : (
            renderPreview(value)
          )}
        </div>
      )}

      {/* Área de upload */}
      {(!value || (multiple && (Array.isArray(value) ? value.length < maxFiles : true))) && (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${uploading ? 'pointer-events-none' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-sm text-gray-600">Subiendo... {uploadProgress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <UploadSimple className="h-12 w-12 text-gray-400 mx-auto" />
              <p className="text-sm text-gray-600">{placeholder}</p>
              <p className="text-xs text-gray-500">
                {multiple ? `Arrastra o click para subir hasta ${maxFiles} imágenes` : 'Arrastra o click para subir una imagen'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <WarningCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Botón adicional para tomar foto (opcional) */}
      {!disabled && !uploading && (!value || multiple) && (
        <button
          type="button"
          onClick={() => {
            // Aquí podrías integrar con la cámara del dispositivo
            fileInputRef.current?.click();
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <Camera className="h-4 w-4" />
          {value ? 'Reemplazar imagen' : 'Tomar foto'}
        </button>
      )}
    </div>
  );
};

export default ImageUpload;
