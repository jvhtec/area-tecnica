
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { PDFDocument } from 'https://cdn.skypack.dev/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { documentUrls, projectName, logoUrl } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create()

    // Add cover page with logo if available
    const coverPage = await generateCoverPage(projectName, logoUrl)
    const [coverPagePage] = await mergedPdf.copyPages(coverPage, [0])
    mergedPdf.addPage(coverPagePage)

    // Add index page
    const indexPage = await generateIndexPage(documentUrls)
    const [indexPagePage] = await mergedPdf.copyPages(indexPage, [0])
    mergedPdf.addPage(indexPagePage)

    // Merge all documents
    for (const url of Object.values(documentUrls)) {
      if (!url) continue
      
      const response = await fetch(url)
      const arrayBuffer = await response.arrayBuffer()
      const pdf = await PDFDocument.load(arrayBuffer)
      
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
      pages.forEach(page => mergedPdf.addPage(page))
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save()

    // Upload to Supabase Storage
    const timestamp = new Date().getTime()
    const filePath = `${projectName}/memoria_tecnica_${timestamp}.pdf`
    
    const { error: uploadError, data } = await supabase.storage
      .from('memoria-tecnica')
      .upload(filePath, mergedPdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage
      .from('memoria-tecnica')
      .getPublicUrl(filePath)

    return new Response(
      JSON.stringify({ url: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function generateCoverPage(projectName: string, logoUrl: string | null) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()

  // Add logo if available
  if (logoUrl) {
    const response = await fetch(logoUrl)
    const imageBytes = await response.arrayBuffer()
    let image
    
    if (logoUrl.endsWith('.png')) {
      image = await pdfDoc.embedPng(imageBytes)
    } else {
      image = await pdfDoc.embedJpg(imageBytes)
    }
    
    const scaleFactor = 0.5
    const scaledWidth = image.width * scaleFactor
    const scaledHeight = image.height * scaleFactor
    
    page.drawImage(image, {
      x: (width - scaledWidth) / 2,
      y: height - scaledHeight - 50,
      width: scaledWidth,
      height: scaledHeight,
    })
  }

  // Add title
  const fontSize = 24
  page.drawText('MEMORIA TÉCNICA', {
    x: 50,
    y: height / 2 + 50,
    size: fontSize,
  })

  page.drawText(projectName, {
    x: 50,
    y: height / 2,
    size: fontSize - 4,
  })

  return pdfDoc
}

async function generateIndexPage(documentUrls: Record<string, string>) {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage()
  const { height } = page.getSize()

  const titles = {
    material: "1. Listado de Material",
    soundvision: "2. Informe SoundVision",
    weight: "3. Informe de Pesos",
    power: "4. Informe de Consumos",
    rigging: "5. Plano de Rigging"
  }

  page.drawText('ÍNDICE', {
    x: 50,
    y: height - 100,
    size: 16,
  })

  let yOffset = height - 150
  Object.entries(titles).forEach(([key, title]) => {
    if (documentUrls[key]) {
      page.drawText(title, {
        x: 50,
        y: yOffset,
        size: 12,
      })
      yOffset -= 30
    }
  })

  return pdfDoc
}
