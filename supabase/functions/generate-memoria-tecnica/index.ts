
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import * as pdfLib from 'https://cdn.skypack.dev/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { documentUrls, projectName, logoUrl } = await req.json()
    console.log('Received request:', { projectName, documentUrls, logoUrl })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create a new PDF document
    const mergedPdf = await pdfLib.PDFDocument.create()
    console.log('Created new PDF document')

    // Add cover page
    if (logoUrl) {
      try {
        const coverPage = await generateCoverPage(projectName, logoUrl)
        const [coverPagePage] = await mergedPdf.copyPages(coverPage, [0])
        mergedPdf.addPage(coverPagePage)
        console.log('Added cover page with logo')
      } catch (error) {
        console.error('Error generating cover page:', error)
      }
    }

    // Add table of contents
    try {
      const tocPage = await generateTableOfContents(documentUrls)
      const [tocPagePage] = await mergedPdf.copyPages(tocPage, [0])
      mergedPdf.addPage(tocPagePage)
      console.log('Added table of contents')
    } catch (error) {
      console.error('Error generating table of contents:', error)
    }

    // Merge all documents
    for (const [key, url] of Object.entries(documentUrls)) {
      if (!url) continue
      
      try {
        console.log(`Fetching document: ${key}`)
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch ${key}: ${response.statusText}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const pdf = await pdfLib.PDFDocument.load(arrayBuffer)
        console.log(`Loaded PDF for ${key}`)
        
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        pages.forEach(page => mergedPdf.addPage(page))
        console.log(`Added ${pages.length} pages from ${key}`)
      } catch (error) {
        console.error(`Error processing document ${key}:`, error)
      }
    }

    // Save the merged PDF
    const mergedPdfBytes = await mergedPdf.save()
    console.log('Saved merged PDF')

    // Upload to Supabase Storage
    const timestamp = new Date().getTime()
    const filePath = `${projectName}/memoria_tecnica_${timestamp}.pdf`
    
    const { error: uploadError, data } = await supabase.storage
      .from('memoria-tecnica')
      .upload(filePath, mergedPdfBytes, {
        contentType: 'application/pdf',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      throw uploadError
    }

    console.log('Uploaded PDF to storage')

    const { data: { publicUrl } } = supabase.storage
      .from('memoria-tecnica')
      .getPublicUrl(filePath)

    return new Response(
      JSON.stringify({ url: publicUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in edge function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function generateCoverPage(projectName: string, logoUrl: string) {
  const pdfDoc = await pdfLib.PDFDocument.create()
  const page = pdfDoc.addPage()
  const { width, height } = page.getSize()

  // Add logo if available
  try {
    const response = await fetch(logoUrl)
    if (!response.ok) throw new Error(`Failed to fetch logo: ${response.statusText}`)
    
    const imageBytes = await response.arrayBuffer()
    let image
    
    if (logoUrl.toLowerCase().endsWith('.png')) {
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
  } catch (error) {
    console.error('Error adding logo to cover page:', error)
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

async function generateTableOfContents(documentUrls: Record<string, string>) {
  const pdfDoc = await pdfLib.PDFDocument.create()
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
