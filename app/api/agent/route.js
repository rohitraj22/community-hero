import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(request) {
  let lat = 12.9716;
  let lng = 77.5946;
  let recipientEmail = "Feature not available outside India";
  let state = "";
  let country = "";
  let reporterName = "Concerned Citizen";
  let reporterAddress = "Local Address";

  try {
    const formData = await request.formData();
    const imageFile = formData.get('image');
    const userNotes = formData.get('userNotes') || '';
    const latVal = formData.get('lat');
    const lngVal = formData.get('lng');
    
    const nameVal = formData.get('reporterName');
    const addrVal = formData.get('reporterAddress');
    if (nameVal) reporterName = nameVal;
    if (addrVal) reporterAddress = addrVal;

    if (latVal) lat = parseFloat(latVal);
    if (lngVal) lng = parseFloat(lngVal);

    if (!imageFile) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = buffer.toString('base64');

    // Nominatim Reverse Geocoding
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'Community-Hero-App-Civic'
        }
      });
      const geoData = await geoRes.json();
      if (geoData && geoData.address) {
        country = geoData.address.country || "";
        state = geoData.address.state || geoData.address.region || geoData.address.county || "";
      }
    } catch (err) {
      console.error("Reverse geocoding failed on server:", err);
    }

    const isIndia = country.toLowerCase().includes('india');
    if (isIndia) {
      recipientEmail = "rohitraj492003@gmail.com";
    } else {
      recipientEmail = "Feature not available outside India";
    }

    const systemInstruction = `
      You are an expert Civic Infrastructure Analyst and Municipal Liaison.
      You participate in a multi-turn assessment to inspect community reports, classify hazards, route them to proper local authorities, and output citizen safety actions.
      
      Assess severity on a scale of 1.0 (minor) to 5.0 (critical) based strictly on this rubric:
      - 1.0 - 1.9 (Minor): Cosmetic issues, small amount of litter, minor pavement cracks.
      - 2.0 - 2.9 (Low): Minor issues like small potholes on quiet streets, street light out, overflowing dustbins.
      - 3.0 - 3.9 (Medium): Moderate issues (medium potholes, broken sidewalk slabs, minor water leakage).
      - 4.0 - 4.9 (High): Significant hazards (deep potholes on busy roads, major burst pipelines, hanging cables).
      - 5.0 (Critical): Extreme life-threatening hazards (exposed high-voltage cables on wet walkways, sinkholes).
      
      Be objective and avoid inflating severity. Simple or moderate issues should be scored as 1.0 to 3.5.
    `;

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemInstruction,
    });

    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: imageFile.type,
      },
    };

    // Initialize stateful agentic chat session
    const chat = model.startChat();

    // Turn 1: Inspection and Severity Classification
    const prompt1 = `Inspect the provided image and classify the civic issue. User Notes: "${userNotes}".
    Respond in JSON:
    {
      "title": "Brief descriptive title of the issue",
      "category": "One of: Roads & Infrastructure, Sanitation, Water Leakage, Streetlights, Public Facilities, Safety Hazard, Other",
      "severity": 1.0-5.0 (Float based on rubric: 1.0=Minor, 2.0=Low, 3.0=Medium, 4.0=High, 5.0=Critical),
      "severityReasoning": "Brief objective explanation for the severity score based on the rubric",
      "description": "An objective summary of what is broken"
    }`;

    console.log("Agent Turn 1: Analyzing image...");
    const result1 = await chat.sendMessage([
      { text: prompt1 },
      imagePart
    ]);
    const responseText1 = result1.response.text();
    console.log("Agent Turn 1 Response:", responseText1);

    // Turn 2: Municipal Routing and Official Letter Drafting
    const prompt2 = `Based on your classification, determine the correct municipal agency (e.g., BBMP for roads/litter, BWSSB for water leakage, BESCOM for electricity/streetlights if in Bangalore, or standard local departments). 
    Write a formal complaint letter addressed to the Executive Engineer of that agency. Cite coordinates Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)} and state/region name "${state || 'local region'}". 
    At the end of the letter, sign off with "Sincerely," followed by the reporter's name: "${reporterName}" and their registered address: "${reporterAddress}". Make sure to include both the name and address in the signature sign-off.
    Do NOT include geographic coordinates (Lat/Lng) inside the Subject line of the email. Write only the general location/place name in the Subject line. Write the coordinates strictly inside the body part of the letter.
    Estimate a resolution timeline (e.g., '3-5 business days') with a brief explanation based on category and severity.
    Respond in JSON:
    {
      "complaintDraft": "Full formal complaint text starting with 'To,'",
      "resolutionTimeline": "Resolution timeline estimate with explanation"
    }`;

    console.log("Agent Turn 2: Routing and drafting complaint...");
    const result2 = await chat.sendMessage(prompt2);
    const responseText2 = result2.response.text();
    console.log("Agent Turn 2 Response:", responseText2);

    // Turn 3: Safety recommendations, Reference ID, and Final Synthesis
    const prompt3 = `Finally, generate 1-3 immediate actionable citizen safety recommendations. Also generate a unique issue reference ID starting with 'CH-' followed by 6 uppercase letters/digits.
    Synthesize all details from our conversation and output ONLY one single valid JSON object containing:
    {
      "title": "...",
      "category": "...",
      "severity": ...,
      "severityReasoning": "...",
      "description": "...",
      "complaintDraft": "...",
      "resolutionTimeline": "...",
      "civicActions": ["action1", "action2"],
      "refId": "..."
    }
    Respond ONLY with the raw JSON object. Do not wrap in markdown code blocks, backticks, or include any extra text.`;

    console.log("Agent Turn 3: Generating safety actions and synthesizing final report...");
    const result3 = await chat.sendMessage(prompt3);
    const responseText3 = result3.response.text();
    console.log("Agent Turn 3 Final Response:", responseText3);

    const cleanedText = responseText3
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    const parsedResult = JSON.parse(cleanedText);

    // Guarantee name and address signature programmatically
    let draft = parsedResult.complaintDraft || "";
    if (draft && !draft.includes(reporterName)) {
      draft = draft.replace(/Sincerely,[\s\S]*$/gi, "");
      draft = draft.replace(/Sincerely[\s\S]*$/gi, "");
      draft = draft.replace(/Yours Sincerely,[\s\S]*$/gi, "");
      draft = draft.replace(/Yours Sincerely[\s\S]*$/gi, "");
      draft = draft.trim();
      draft += `\n\nSincerely,\n${reporterName}\nAddress: ${reporterAddress}\nCommunity Hero Platform`;
      parsedResult.complaintDraft = draft;
    }

    parsedResult.recipientEmail = recipientEmail;
    parsedResult.lat = lat;
    parsedResult.lng = lng;
    return NextResponse.json(parsedResult);

  } catch (error) {
    console.error('Server error inside agent route:', error.message);
    console.error('Full error:', error);
    return NextResponse.json({
      error: 'Failed to analyze the image. Please fill out details manually or check your Gemini API key.',
      details: error.message
    }, { status: 500 });
  }
}
