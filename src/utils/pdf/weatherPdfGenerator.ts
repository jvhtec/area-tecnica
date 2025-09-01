import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getWeatherForJob } from '@/utils/weather/weatherApi';
import { supabase } from '@/lib/supabase';
import { WeatherData } from '@/types/hoja-de-ruta';

export interface WeatherPdfData {
  jobTitle: string;
  logoUrl?: string;
  venue?: {
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  jobDates: Date[];
}

export const generateWeatherPDF = async (data: WeatherPdfData): Promise<Blob> => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.width;
  
  // Add logo if available
  let yPosition = 20;
  if (data.logoUrl) {
    try {
      const response = await fetch(data.logoUrl);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
      pdf.addImage(base64, 'JPEG', pageWidth - 60, 10, 50, 30);
    } catch (error) {
      console.warn('Could not load logo for weather PDF:', error);
    }
  }
  
  // Title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Weather Forecast', 20, yPosition);
  yPosition += 10;
  
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'normal');
  pdf.text(data.jobTitle, 20, yPosition);
  yPosition += 20;
  
  // Fetch weather data
  const eventDatesString = data.jobDates.length > 0 
    ? data.jobDates.length === 1
      ? data.jobDates[0].toISOString().split('T')[0].split('-').reverse().join('/')
      : `${data.jobDates[0].toISOString().split('T')[0].split('-').reverse().join('/')} - ${data.jobDates[data.jobDates.length - 1].toISOString().split('T')[0].split('-').reverse().join('/')}`
    : '';
  
  let weatherData: WeatherData[] | null = null;
  
  if (data.venue && eventDatesString) {
    try {
      weatherData = await getWeatherForJob(data.venue, eventDatesString);
    } catch (error) {
      console.error('Error fetching weather data for PDF:', error);
    }
  }
  
  if (weatherData && weatherData.length > 0) {
    // Create weather table
    const tableData = weatherData.map(weather => {
      const date = new Date(weather.date).toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric' 
      });
      
      const temp = `${Math.round(weather.maxTemp)}°C / ${Math.round(weather.minTemp)}°C`;
      const precipitation = weather.precipitationProbability > 0 
        ? `${weather.precipitationProbability}%` 
        : 'None';
      
      return [date, weather.condition, temp, precipitation];
    });
    
    autoTable(pdf, {
      startY: yPosition,
      head: [['Date', 'Condition', 'Temperature', 'Rain Chance']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      bodyStyles: {
        textColor: 50
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 30 }
      },
      margin: { left: 20, right: 20 }
    });
    
    yPosition = (pdf as any).lastAutoTable.finalY + 20;
    
    // Add weather source info
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    pdf.text('Weather data provided by Open-Meteo (open-meteo.com)', 20, yPosition);
    pdf.text(`Generated on: ${new Date().toLocaleString()}`, 20, yPosition + 10);
    
  } else {
    // No weather data available
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Weather data not available for the selected dates and location.', 20, yPosition);
    
    if (!data.venue?.address && !data.venue?.coordinates) {
      pdf.text('Please add venue location information to enable weather forecasts.', 20, yPosition + 15);
    }
    
    if (data.jobDates.length === 0) {
      pdf.text('Please add event dates to enable weather forecasts.', 20, yPosition + 30);
    }
  }
  
  return new Blob([pdf.output('blob')], { type: 'application/pdf' });
};