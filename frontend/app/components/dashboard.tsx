"use client";

import * as React from "react"
import { Upload, FileText, X, Target, Sparkles } from "lucide-react"
import Copy from "lucide-react/dist/esm/icons/copy"
import File from "lucide-react/dist/esm/icons/file"
import Printer from "lucide-react/dist/esm/icons/printer"
import remarkGfm from 'remark-gfm'
import ReactMarkdown from "react-markdown"
import { Toaster, toast } from 'sonner' 
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  originFile: File
}

export function FileUploadDashboard() {
  const [careerGoal, setCareerGoal] = React.useState("")
  const [files, setFiles] = React.useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = React.useState(false)
  const [markdownContent, setMarkdownContent] = React.useState<string>(`
# Welcome to Your Career Analysis

Upload your resume and enter a description to get started.

## How it works

1. **Drag & Drop** your resume file into the upload zone
2. **Enter your description** in the text field
3. **View results** in this area once processing is complete

---

### Sample Analysis Output

Once you upload your files, you'll see:

- **Skills Assessment** - A breakdown of your current skills
- **Gap Analysis** - Skills you need to develop
- **Recommendations** - Actionable steps to reach your goal

\`\`\`
Example skill match: 85%
Top missing skills: Leadership, Data Analysis
\`\`\`

> Pro tip: The more detailed your description, the better the analysis!
`)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  // Pseudo-fullscreen fallback for environments where Fullscreen API fails
  const [isPseudoFullscreen, setIsPseudoFullscreen] = React.useState(false)

  // Auto-scroll to bottom when new analysis content arrives
  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight
    }, 50)
    return () => clearTimeout(t)
  }, [markdownContent])



  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      addFiles(selectedFiles)
    }
  }

  const addFiles = (newFiles: File[]) => {
    const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      type: file.type,
      originFile: file,
    }))
    setFiles((prev) => [...prev, ...uploadedFiles])
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleAnalyze = async () => {
    
    // Prevent submitting if BOTH are empty
    if (files.length === 0 && !careerGoal) {
      alert("Please upload a file OR enter a description.")
      return
    }
    
    setError(null)
    setLoading(true)
    
    try {
      // 1. Create the form data to send to Python
      const formData = new FormData()
      
      // We grab the FIRST file uploaded (files[0])
      if (files.length > 0) {
        formData.append("file", files[0].originFile) 
      }

      // We grab the text from the input box
      formData.append("user_query", careerGoal) 

      // Debug: log what we're sending
      console.log("[analyze] Sending request", { file: files[0]?.name, careerGoal })

      // 2. Send it to your backend
      // Make sure main.py is running on port 8000!
      const response = await fetch("https://levelup-backend-a02d.onrender.com", {
        method: "POST",
        body: formData,
      })

      // Read raw response text first to help debugging server errors
      const raw = await response.text()
      if (!response.ok) {
        console.error("[analyze] Server error response:", raw)
        let message = "Failed to communicate with the server"
        try {
          const parsed = JSON.parse(raw)
          message = parsed.message || parsed.error || message
        } catch (e) {
          // Not JSON, keep raw text
          message = raw || message
        }
        throw new Error(message)
      }

      // Try to parse JSON; if not JSON, use raw text as analysis
      let data: any = {}
      try {
        data = JSON.parse(raw)
      } catch (e) {
        data.analysis = raw
      }

      // 4. Update the Markdown screen with the AI's answer
      setMarkdownContent(data.analysis)

    } catch (err) {
      console.error(err)
      setError((err as Error)?.message || "Analysis failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Helper: robust copy with textarea fallback
  const safeCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (e) {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        ta.remove()
        return true
      } catch (err) {
        console.error('Fallback copy failed', err)
        return false
      }
    }
  }

  const handleCopyMarkdown = async () => {
    // Prefer copying the raw markdown when available, else fall back to visible text
    const prefer = (markdownContent || '').trim()
    const text = prefer ? prefer : (scrollRef.current ? scrollRef.current.innerText.trim() : '')
    const ok = await safeCopy(text)
    if (ok) toast.success('Markdown copied')
    else toast.error('Copy failed')
  }

  // keep old name for compatibility
  const handleCopyText = handleCopyMarkdown

  const handleDownloadDocx = () => {
    const el = scrollRef.current
    if (!el) return
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Analysis</title></head><body>${el.innerHTML}</body></html>`
    const blob = new Blob([html], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'analysis.docx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast.success('Downloaded .docx')
  }

  const handleDownloadPDF = () => {
    const el = scrollRef.current
    if (!el) return
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Analysis</title><style>body{font-family:Inter,system-ui,Arial;padding:20px;color:#111827}pre{white-space:pre-wrap}</style></head><body>${el.innerHTML}</body></html>`
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Unable to open print window')
      return
    }
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      toast.success('Print dialog opened — choose Save as PDF')
    }, 300)
  }

  return (
    <div className="min-h-screen relative">
      {/* Technical Grid Background */}
      <div className="fixed inset-0 z-0 technical-grid pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 px-6 md:px-12 lg:px-20 py-12">
        {/* Toasts */}
        <Toaster position="top-right" />
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-5 h-5 bg-foreground text-background flex items-center justify-center rounded-sm">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="font-sans text-sm font-bold tracking-tight">
              LevelUp
            </span>
          </div>
          <h1 className="font-sans text-5xl md:text-6xl font-semibold tracking-tighter leading-[0.95] mb-4">
            Self-learning
            <br />
            <span className="text-muted-foreground">Platform.</span>
          </h1>
          <p className="max-w-md font-sans text-base text-muted-foreground leading-relaxed">
            Learn effectively: As a student or professional.
            <br></br>
            LevelUp for your career development.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Upload and Input */}
          <div className="space-y-6">
            {/* Drag and Drop Zone */}
            <div className="premium-card rounded-xl overflow-hidden">
              <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-border" />
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Upload Files
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="w-8 h-1 rounded-full bg-border/50" />
                </div>
              </div>
              <div className="p-6">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-300",
                    isDragging
                      ? "border-foreground bg-foreground/5 scale-[1.01]"
                      : "border-border hover:border-foreground/40 hover:bg-secondary/50"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors duration-300",
                    isDragging ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                  )}>
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-medium">
                    {isDragging ? "Drop files here" : "Drag & drop files here"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    or click to browse
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.txt"
                  />
                </div>

                {/* Uploaded Files List */}
                {files.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
                      Uploaded ({files.length})
                    </p>
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-4 py-3 transition-all duration-200 hover:border-foreground/20"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center shrink-0">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="truncate text-sm font-medium">
                              {file.name}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(file.id)
                          }}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remove file</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description Input */}
            <div className="premium-card rounded-xl overflow-hidden">
              <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-border" />
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Description
                  </span>
                </div>
                <Target className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="p-6">
                {/* suppressHydrationWarning: some browser extensions inject attributes (e.g. fdprocessedid)
                    into SSR HTML causing React hydration warnings. This prop prevents noisy console errors.
                */}
                <Input
                  id="career-goal"
                  placeholder="e.g., Become a Senior Software Engineer at a tech company"
                  value={careerGoal}
                  onChange={(e) => setCareerGoal(e.target.value)}
                  suppressHydrationWarning
                  className="w-full border-border bg-secondary/30 focus:border-foreground/40 focus:ring-foreground/10 transition-all duration-200"
                />
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                  Describe your ideal career destination or professional objective. 
                  The more specific, the better the analysis.
                </p>
              </div>
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={loading || (files.length === 0 && !careerGoal.trim())}
              className="group relative isolate overflow-hidden w-full bg-foreground text-background text-sm font-semibold px-8 py-4 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-white/10 transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-[1.02] hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.3)] hover:ring-white/20 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
            >
              <div className="shimmer-layer absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent z-0 pointer-events-none" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? "Analyzing..." : "Analyze"}
                <Sparkles className="w-4 h-4" />
              </span>
            </button>
          </div>

          {/* Right Column - Markdown Results */}
          <div className="premium-card rounded-xl overflow-hidden flex flex-col">
            <div className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Analysis Results
                </span>
              </div>
              <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-secondary border border-border/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-medium text-muted-foreground tracking-tight">
                  Ready
                </span>
              </div>

              {/* Action buttons: Copy / Download */}
              <div className="ml-3 inline-flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded bg-secondary/50 hover:bg-secondary"
                  title="Copy markdown"
                  onClick={handleCopyMarkdown}
                >
                  <Copy className="w-4 h-4" />
                </button>

                <button
                  className="px-2 py-1 rounded bg-secondary/50 hover:bg-secondary"
                  title="Download .md"
                  onClick={() => {
                    const blob = new Blob([markdownContent || ""], { type: 'text/markdown;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'analysis.md'
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                    toast.success('Downloaded .md')
                  }}
                >
                  <FileText className="w-4 h-4" />
                </button>

                <button
                  className="px-2 py-1 rounded bg-secondary/50 hover:bg-secondary"
                  title="Download .html"
                  onClick={() => {
                    const el = scrollRef.current
                    if (!el) return
                    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Analysis</title><style>body{font-family:Inter,system-ui,Arial;padding:20px;color:#111827}pre{white-space:pre-wrap}</style></head><body>${el.innerHTML}</body></html>`
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'analysis.html'
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                    toast.success('Downloaded .html')
                  }}
                >
                  <FileText className="w-4 h-4" />
                </button>

                <button
                  className="px-2 py-1 rounded bg-secondary/50 hover:bg-secondary"
                  title="Download .docx"
                  onClick={handleDownloadDocx}
                >
                  <File className="w-4 h-4" />
                </button>

                <button
                  className="px-2 py-1 rounded bg-secondary/50 hover:bg-secondary"
                  title="Download PDF (opens print dialog)"
                  onClick={handleDownloadPDF}
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-6">
              <ScrollArea
                ref={scrollRef}
                className={`h-[520px] rounded-lg border border-border bg-secondary/20 p-6 overflow-auto ${isPseudoFullscreen ? 'fixed inset-4 z-50 rounded-none h-[calc(100%-32px)] bg-white' : ''}`}
              >
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }: { children?: React.ReactNode }) => (
                        <h1 className="mb-6 text-2xl font-semibold tracking-tight text-foreground">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }: { children?: React.ReactNode }) => (
                        <h2 className="mb-4 mt-8 text-lg font-semibold tracking-tight text-foreground">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }: { children?: React.ReactNode }) => (
                        <h3 className="mb-3 mt-6 text-base font-semibold tracking-tight text-foreground">
                          {children}
                        </h3>
                      ),
                      p: ({ children }: { children?: React.ReactNode }) => (
                        <p className="mb-4 leading-relaxed text-muted-foreground">
                          {children}
                        </p>
                      ),
                      ul: ({ children }: { children?: React.ReactNode }) => (
                        <ul className="mb-4 list-disc space-y-2 pl-5 text-muted-foreground">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }: { children?: React.ReactNode }) => (
                        <ol className="mb-4 list-decimal space-y-2 pl-5 text-muted-foreground">
                          {children}
                        </ol>
                      ),
                      li: ({ children }: { children?: React.ReactNode }) => (
                        <li className="pl-1 leading-relaxed">{children}</li>
                      ),
                      code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
                        const isInline = !className
                        return isInline ? (
                          <code className="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground border border-border/50">
                            {children}
                          </code>
                        ) : (
                          <code className="block overflow-x-auto rounded-lg bg-foreground text-background p-4 text-xs font-mono">
                            {children}
                          </code>
                        )
                      },
                      table: ({ children }: { children?: React.ReactNode }) => (
                        <div className="overflow-x-auto">
                          <table className="min-w-full table-auto border-collapse">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }: { children?: React.ReactNode }) => (
                        <th className="px-3 py-2 bg-background text-sm font-semibold text-foreground border border-border">
                          {children}
                        </th>
                      ),
                      td: ({ children }: { children?: React.ReactNode }) => (
                        <td className="px-3 py-2 text-sm text-muted-foreground border border-border align-top">
                          {children}
                        </td>
                      ),
                      pre: ({ children }: { children?: React.ReactNode }) => (
                        <pre className="mb-4 overflow-x-auto rounded-lg bg-foreground text-background p-4">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }: { children?: React.ReactNode }) => (
                        <blockquote className="mb-4 border-l-2 border-foreground pl-4 italic text-muted-foreground">
                          {children}
                        </blockquote>
                      ),
                      hr: () => <hr className="my-8 border-border" />,
                      strong: ({ children }: { children?: React.ReactNode }) => (
                        <strong className="font-semibold text-foreground">
                          {children}
                        </strong>
                      ),
                    }}
                  >
                    {markdownContent}
                  </ReactMarkdown>
                </div>
              </ScrollArea>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
