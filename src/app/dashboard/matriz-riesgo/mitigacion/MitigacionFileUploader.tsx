'use client'

import { useState } from 'react'
import { uploadMitigacionFiles } from './upload-action'

export default function MitigacionFileUploader({ 
    initialFiles, 
    onUpload 
}: { 
    initialFiles: string[], 
    onUpload: (paths: string[]) => void 
}) {
    const [uploading, setUploading] = useState(false)
    const [files, setFiles] = useState<string[]>(initialFiles)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files
        if (!selectedFiles || selectedFiles.length === 0) return

        if (selectedFiles.length > 4) {
            alert("Máximo 4 archivos.")
            return
        }

        const formData = new FormData()
        Array.from(selectedFiles).forEach(f => formData.append('files', f))

        setUploading(true)
        const res = await uploadMitigacionFiles(formData)
        setUploading(false)

        if (res.success && res.paths) {
            setFiles(res.paths)
            onUpload(res.paths)
        } else {
            alert(res.error)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {files.map((path, idx) => (
                    <div key={idx} className="relative group overflow-hidden rounded-2xl border border-slate-200 w-16 h-16 bg-slate-50 flex items-center justify-center">
                        {path.endsWith('.pdf') ? (
                            <span className="text-xl">📄</span>
                        ) : (
                            <img src={path} className="w-full h-full object-cover" alt="evidencia" />
                        )}
                        <a 
                            href={path} 
                            target="_blank" 
                            className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-black uppercase"
                        >
                            Ver
                        </a>
                    </div>
                ))}
                
                {files.length < 4 && (
                    <label className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50 transition-all text-slate-400 hover:text-cyan-600">
                        <span className="text-xl">{uploading ? '⏳' : '+'}</span>
                        <input 
                            type="file" 
                            multiple 
                            accept=".pdf,image/*" 
                            className="hidden" 
                            onChange={handleFileChange}
                            disabled={uploading}
                        />
                    </label>
                )}
            </div>
            {files.length > 0 && (
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight flex items-center gap-1">
                    <span>✅</span> {files.length} Evidencia(s) cargada(s)
                </p>
            )}
        </div>
    )
}
