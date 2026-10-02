import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import { createWorker } from "tesseract.js";
import { Loader2 } from "lucide-react";

export default function IdVerification({
  step,
  onIdCaptured,
  onSelfieCaptured,
}) {
  const webcamRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  const captureIDPhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      processOCR(imageSrc);
    }
  }, [webcamRef]);

  const processOCR = async (imageSrc) => {
    setIsScanning(true);
    setScanProgress(0);
    try {
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setScanProgress(Math.round(m.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(imageSrc);
      await worker.terminate();

      const parsedData = parseIDDetails(data.text);
      onIdCaptured(imageSrc, parsedData);
    } catch (err) {
      console.error("OCR Error:", err);
      // Proceed to the next step even if OCR fails to read the text
      onIdCaptured(imageSrc, {});
    } finally {
      setIsScanning(false);
    }
  };

  const parseIDDetails = (text) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    let extractedIdNum = "";
    let extractedName = "";

    const idRegex =
      /(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4})|(\d{2}[-\s]?\d{7}[-\s]?\d{1})|([A-Z0-9]{3,4}[-\s]?[0-9]{7,8})/;
    const idMatch = text.match(idRegex);
    if (idMatch) extractedIdNum = idMatch[0].replace(/\s+/g, "-");

    const ignoreWords = [
      "REPUBLIC",
      "PHILIPPINES",
      "NATIONAL",
      "IDENTITY",
      "CARD",
      "DRIVER",
      "LICENSE",
      "NAME",
      "SEX",
      "DATE",
      "BIRTH",
      "ADDRESS",
      "LAST",
      "FIRST",
      "MIDDLE",
    ];
    const possibleNameLines = lines.filter((line) => {
      const upper = line.toUpperCase();
      return (
        !ignoreWords.some((word) => upper.includes(word)) &&
        line.length > 3 &&
        /^[A-Za-z\s.,-]+$/.test(line)
      );
    });

    if (possibleNameLines.length > 0) {
      extractedName = possibleNameLines.slice(0, 2).join(" ");
    }

    let firstName = "";
    let lastName = "";
    if (extractedName) {
      const nameParts = extractedName.split(" ");
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(" ");
      } else {
        firstName = nameParts[0];
      }
    }

    return { idNumber: extractedIdNum, firstName, lastName };
  };

  const captureSelfiePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      onSelfieCaptured(imageSrc);
    }
  }, [webcamRef]);

  if (step === "id-scan") {
    return (
      <div
        style={{
          position: "absolute", // 🌟 FIXED: Breaks out of scrolling container
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "#000",
          borderRadius: "0 0 20px 20px", // Optional: matches card corners if needed
          display: "flex",
          flexDirection: "column",
          animation: "contentFade 0.3s ease-out",
          overflow: "hidden",
          zIndex: 10, // Ensures it sits above other content in the box
        }}
      >
        <div
          style={{
            padding: "15px",
            color: "#facc15",
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "0.9rem",
            background: "rgba(15, 23, 42, 0.9)", // Darker, cleaner header
            zIndex: 2,
          }}
        >
          Step 1: Align ID inside the frame
        </div>

        <div style={{ flex: 1, position: "relative" }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              top: "45%", // Slightly higher than center to leave room for the button
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "85%",
              height: "220px",
              border: "3px solid #10b981",
              borderRadius: "12px",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)", // Darker backdrop to focus the ID
            }}
          ></div>
        </div>

        {isScanning ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(27, 11, 140, 0.95)",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <Loader2
              size={40}
              className="animate-spin"
              style={{ marginBottom: "15px" }}
            />
            <span
              style={{
                fontWeight: "bold",
                fontSize: "1rem",
                letterSpacing: "1px",
              }}
            >
              Extracting Data... {scanProgress}%
            </span>
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              bottom: "40px", // 🌟 FIXED: Absolute position the button over the camera
              left: "0",
              right: "0",
              display: "flex",
              justifyContent: "center",
              zIndex: 5,
            }}
          >
            <button
              onClick={captureIDPhoto}
              style={{
                width: "70px", // Slightly larger button
                height: "70px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.5)",
                border: "4px solid #10b981", // Green border to match the target frame
                cursor: "pointer",
                backdropFilter: "blur(4px)",
              }}
            >
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "#ffffff",
                  margin: "auto",
                }}
              />
            </button>
          </div>
        )}
      </div>
    );
  }

  if (step === "selfie-scan") {
    return (
      <div
        style={{
          position: "absolute", // 🌟 FIXED: Breaks out of scrolling container
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "#000",
          borderRadius: "0 0 20px 20px",
          display: "flex",
          flexDirection: "column",
          animation: "contentFade 0.3s ease-out",
          overflow: "hidden",
          zIndex: 10,
        }}
      >
        <div
          style={{
            padding: "15px",
            color: "#4ade80",
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "0.9rem",
            background: "rgba(15, 23, 42, 0.9)",
            zIndex: 2,
          }}
        >
          Step 2: Position face inside the circle
        </div>

        <div style={{ flex: 1, position: "relative" }}>
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user" }}
            mirrored={true}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              top: "45%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "260px", // Slightly larger circle for easier framing
              height: "260px",
              border: "3px solid #4ade80",
              borderRadius: "50%",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
            }}
          ></div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "40px", // 🌟 FIXED: Absolute position over camera
            left: "0",
            right: "0",
            display: "flex",
            justifyContent: "center",
            zIndex: 5,
          }}
        >
          <button
            onClick={captureSelfiePhoto}
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              background: "rgba(255, 255, 255, 0.5)",
              border: "4px solid #4ade80",
              cursor: "pointer",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "50%",
                background: "#ffffff",
                margin: "auto",
              }}
            />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
