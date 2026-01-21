
import { GoogleGenAI } from "@google/genai";
import { AnalysisResult, GroundingSource, DoctorSearchResult, MapSource, Vitals } from "../types";

export const analyzeSymptoms = async (
  symptoms: string, 
  image: {data: string, mimeType: string} | null = null,
  vitals: Vitals | null = null,
  language: string = 'English'
): Promise<AnalysisResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const modelName = image ? 'gemini-2.5-flash' : 'gemini-3-flash-preview';

  let vitalsContext = "";
  if (vitals) {
    const parts = [];
    if (vitals.temp) parts.push(`Temperature: ${vitals.temp}°F`);
    if (vitals.hr) parts.push(`Heart Rate: ${vitals.hr} bpm`);
    if (vitals.bpSys && vitals.bpDia) parts.push(`Blood Pressure: ${vitals.bpSys}/${vitals.bpDia} mmHg`);
    if (vitals.spo2) parts.push(`Oxygen Saturation: ${vitals.spo2}%`);
    
    if (parts.length > 0) {
      vitalsContext = `\nPATIENT VITALS:\n${parts.join('\n')}\n`;
    }
  }

  // System Instruction: Sets the behavior "laws" for the model
  const systemInstruction = `
    You are a highly experienced medical information assistant.
    
    GLOBAL OUTPUT RULES:
    1. You must act as a medical professional.
    2. The user's requested language is: "${language}".
    3. The FIRST LINE of your response MUST be metadata in ENGLISH (regardless of the requested language), following this exact format:
       CONFIDENCE_SCORE: [0-100] | CONFIDENCE_LABEL: [High/Medium/Low]
    4. The REST of the response (the body) MUST be written strictly in "${language}".
    5. Translate ALL Markdown headers (e.g., # Summary, ## Recommendations) into "${language}".
    6. Include a disclaimer in "${language}" at the end.
    
    Calculated Confidence Logic:
    - High (80-100%): Symptoms/Images are clear.
    - Medium (50-79%): Symptoms are common/ambiguous.
    - Low (0-49%): Information is insufficient.
  `;

  const prompt = `
    Analyze the provided ${image ? 'medical image/photo' : 'symptoms'}.
    
    Patient Context:
    "${symptoms}"

    ${vitalsContext}

    Structure your response in Markdown:
    1. Summary (in ${language})
    2. Potential Conditions (in ${language})
    3. Urgency (Low/Medium/High/Emergency) (in ${language})
    4. Recommendations (in ${language})

    Remember: First line ENGLISH metadata. Rest in ${language}.
  `;

  const requestParts: any[] = [];
  
  if (image) {
    requestParts.push({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType, 
      },
    });
  }
  
  requestParts.push({ text: prompt });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { parts: requestParts },
      config: {
        systemInstruction: systemInstruction, // Stronger instruction enforcement
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    const fullText = response.text || "Unable to generate analysis. Please try again.";
    
    let confidence = { score: 0, label: "Low" };
    let content = fullText;

    const lines = fullText.split('\n');
    const firstLine = lines[0].trim();

    // Parse English Metadata
    if (firstLine.includes('CONFIDENCE_SCORE:')) {
      try {
        const scoreMatch = firstLine.match(/CONFIDENCE_SCORE:\s*(\d+)/);
        const labelMatch = firstLine.match(/CONFIDENCE_LABEL:\s*(\w+)/);
        
        if (scoreMatch && labelMatch) {
          confidence = {
            score: parseInt(scoreMatch[1], 10),
            label: labelMatch[1]
          };
          content = lines.slice(1).join('\n').trim();
        }
      } catch (e) {
        console.warn("Failed to parse confidence score", e);
      }
    } else {
        // Fallback: If model missed the metadata line, just assume the whole text is content
        // and try to estimate confidence based on text length or keywords (mock logic here)
        console.warn("Metadata line missing, treating full text as content");
    }

    const sources: GroundingSource[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web && chunk.web.uri && chunk.web.title) {
          sources.push({
            title: chunk.web.title,
            uri: chunk.web.uri
          });
        }
      });
    }

    return {
      content,
      confidence,
      language,
      sources
    };
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze symptoms. Please check your connection or try a different image.");
  }
};

export const findNearbyDoctors = async (medicalContext: string, lat: number, lng: number, language: string = 'English'): Promise<DoctorSearchResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const processResponse = (response: any, defaultTitle: string) => {
    const text = response.text || defaultTitle;
    const mapSources: MapSource[] = [];
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;

    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.maps && chunk.maps.uri && chunk.maps.title) {
          mapSources.push({
            title: chunk.maps.title,
            uri: chunk.maps.uri,
            address: chunk.maps.address 
          });
        }
        else if (chunk.web && chunk.web.uri && chunk.web.title) {
           mapSources.push({
            title: chunk.web.title,
            uri: chunk.web.uri,
            address: '' 
          });
        }
      });
    }
    return { content: text, mapSources };
  };

  // --- ATTEMPT 1: Google Maps with Gemini 2.5 Flash ---
  try {
    console.log("Attempting Google Maps search...");
    const prompt = `
      Context: ${medicalContext}
      User Location: ${lat}, ${lng}
      Output Language: ${language}
      
      Task: Identify the correct specialist type and Find 3 specific medical facilities near the user's location using the Google Maps tool.
      Ensure the response text is in ${language}.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', 
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: { retrievalConfig: { latLng: { latitude: lat, longitude: lng } } }
      }
    });

    const result = processResponse(response, "Maps Search Results");
    
    // If we found map sources, return immediately
    if (result.mapSources.length > 0) {
      return result;
    }
    console.log("No maps results found. Falling back to Search...");
  } catch (error) {
    console.warn("Maps Search failed:", error);
  }

  // --- ATTEMPT 2: Google Search with Gemini 3 Flash (Fallback) ---
  try {
    const fallbackPrompt = `
      Find top-rated doctors, clinics, or hospitals for this condition: "${medicalContext.substring(0, 100)}..."
      Near these coordinates: ${lat}, ${lng}.
      Provide a list with names and addresses if possible.
      Response MUST be in ${language}.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: fallbackPrompt,
      config: { tools: [{ googleSearch: {} }] }
    });

    return processResponse(response, "Search Results");
  } catch (error) {
    console.error("Doctor Search Fallback Error:", error);
    throw new Error("Failed to locate nearby doctors.");
  }
};
