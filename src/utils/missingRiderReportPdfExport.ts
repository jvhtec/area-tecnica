
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

export const exportMissingRiderReportPDF = async (
  jobId: string,
  jobTitle: string,
  logoUrl?: string
): Promise<Blob> => {
  console.log('Generating missing rider report PDF');
  
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  let yPosition = 20;

  // Header
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Missing Rider Report', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 20;

  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(jobTitle, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 30;

  try {
    // Fetch artists with missing riders
    const { data: artists, error } = await supabase
      .from('festival_artists')
      .select('name, stage, date')
      .eq('job_id', jobId)
      .eq('rider_missing', true)
      .order('date', { ascending: true })
      .order('stage', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching missing rider data:', error);
      pdf.text('Error loading missing rider data', 20, yPosition);
      return new Blob([pdf.output('blob')], { type: 'application/pdf' });
    }

    if (!artists || artists.length === 0) {
      pdf.setFontSize(12);
      pdf.text('✅ All artists have submitted their technical riders.', 20, yPosition);
      yPosition += 20;
      pdf.text('No missing riders to report.', 20, yPosition);
    } else {
      pdf.setFontSize(12);
      pdf.text(`⚠️ ${artists.length} artists have missing technical riders:`, 20, yPosition);
      yPosition += 30;

      // Create table with missing riders
      const tableData = artists.map(artist => [
        artist.name,
        `Stage ${artist.stage || 'TBD'}`,
        artist.date || 'TBD'
      ]);

      (pdf as any).autoTable({
        startY: yPosition,
        head: [['Artist Name', 'Stage', 'Date']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [220, 53, 69],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        bodyStyles: { 
          fontSize: 10,
          textColor: [33, 37, 41]
        },
        alternateRowStyles: {
          fillColor: [248, 249, 250]
        }
      });
    }
  } catch (error) {
    console.error('Error generating missing rider report:', error);
    pdf.text('Error generating missing rider report', 20, yPosition);
  }

  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
};
