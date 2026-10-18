import React, { useState, useRef, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { TextRecognition, Script } from "@capacitor-mlkit/text-recognition";
import { createWorker } from "tesseract.js";

export default function IdVerification({
  step,
  idType,
  onIdCaptured,
  onSelfieCaptured,
}) {
  const webcamRef = useRef(null);

  const [scanFeedback, setScanFeedback] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [frozenImage, setFrozenImage] = useState(null);

  const isProcessingRef = useRef(false);
  const intervalRef = useRef(null);

  const [focusPoint, setFocusPoint] = useState({ x: 0, y: 0 });
  const [showFocusRing, setShowFocusRing] = useState(false);

  // 🌟 STREAMLINED PARSER: Strictly scans for ID Numbers only. Ignores all names.
  const parseIDDetails = (text) => {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let extractedIdNum = "";

    for (const line of lines) {
      // Fix common OCR zero/one mistakes
      const cleanLineNumbers = line
        .replace(/O/g, "0")
        .replace(/o/g, "0")
        .replace(/l/g, "1")
        .replace(/I/g, "1");

      // Look for 12-digit National ID (XXXX-XXXX-XXXX-XXXX)
      const philSysMatch = cleanLineNumbers.match(
        /\b(\d{4})[-\s_~]*(\d{4})[-\s_~]*(\d{4})[-\s_~]*(\d{4})\b/,
      );
      if (philSysMatch) {
        extractedIdNum = `${philSysMatch[1]}-${philSysMatch[2]}-${philSysMatch[3]}-${philSysMatch[4]}`;
        break;
      }

      // Look for UMID (XXXX-XXXXXXX-X)
      const umidMatch = cleanLineNumbers.match(
        /\b(\d{4})[-\s_~]*(\d{7})[-\s_~]*(\d{1})\b/,
      );
      if (umidMatch) {
        extractedIdNum = `${umidMatch[1]}-${umidMatch[2]}-${umidMatch[3]}`;
        break;
      }

      // Look for Driver's License (XXX-XX-XXXXXX)
      const driverMatch = cleanLineNumbers.match(
        /\b([A-Z0-9]{3})[-\s_~]*(\d{2})[-\s_~]*(\d{6})\b/i,
      );
      if (driverMatch) {
        extractedIdNum = `${driverMatch[1].toUpperCase()}-${driverMatch[2]}-${driverMatch[3]}`;
        break;
      }
    }

    return { idNumber: extractedIdNum };
  };

  useEffect(() => {
    const isAutoScan = idType === "PhilID" || idType === "DriverLicense";

    if (step === "id-scan" && isAutoScan) {
      setScanFeedback("Scanning automatically...");
      setIsSuccess(false);
      setFrozenImage(null);
      isProcessingRef.current = false;

      intervalRef.current = setInterval(async () => {
        if (isProcessingRef.current || !webcamRef.current) return;
        isProcessingRef.current = true;

        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) {
          isProcessingRef.current = false;
          return;
        }

        try {
          let text = "";

          if (Capacitor.isNativePlatform()) {
            const base64Data = imageSrc.split(",")[1];
            const fileName = `temp_id_${Date.now()}.jpeg`;

            const savedFile = await Filesystem.writeFile({
              path: fileName,
              data: base64Data,
              directory: Directory.Cache,
            });

            const result = await TextRecognition.processImage({
              path: savedFile.uri,
              script: Script.Latin,
            });
            text = result.text;

            await Filesystem.deleteFile({
              path: fileName,
              directory: Directory.Cache,
            });
          } else {
            const worker = await createWorker("eng");
            const { data } = await worker.recognize(imageSrc);
            text = data.text;
            await worker.terminate();
          }

          const parsedData = parseIDDetails(text);

          // 🌟 FAST SUCCESS TRIGGER: Stops as soon as the ID number is found
          if (parsedData.idNumber) {
            clearInterval(intervalRef.current);
            setIsSuccess(true);

            const finalCapture = webcamRef.current.getScreenshot() || imageSrc;
            setFrozenImage(finalCapture);
            setScanFeedback(`ID Number Found: ${parsedData.idNumber}`);

            setTimeout(() => {
              // Pass ONLY the idNumber back to SignUp.jsx
              onIdCaptured(finalCapture, parsedData);
            }, 1500);
          } else {
            setScanFeedback("Align ID to scan Number...");
            isProcessingRef.current = false;
          }
        } catch (err) {
          console.error("Auto-Scan Error:", err);
          isProcessingRef.current = false;
        }
      }, 1000);
    } else {
      if (step === "id-scan")
        setScanFeedback("Take a clear photo of the FRONT of your ID.");
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [step, idType, onIdCaptured]);

  const manualCapture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (step === "id-scan") {
        onIdCaptured(imageSrc, {});
      } else {
        onSelfieCaptured(imageSrc);
      }
    }
  }, [webcamRef, step, onIdCaptured, onSelfieCaptured]);

  const handleTapToFocus = async (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setFocusPoint({ x, y });
    setShowFocusRing(true);

    setTimeout(() => {
      setShowFocusRing(false);
    }, 1000);

    const video = webcamRef.current?.video;
    if (video && video.srcObject) {
      const track = video.srcObject.getVideoTracks()[0];
      const capabilities = track.getCapabilities();

      if (capabilities.focusMode) {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: "continuous" }],
          });
        } catch (err) {}
      }
    }
  };

  const isAutoScanMode = idType === "PhilID" || idType === "DriverLicense";

  if (step === "id-scan") {
    return (
      <div
        style={{
          position: "absolute",
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
        {/* 🌟 INACCURACY WARNING BANNER */}
        {isAutoScanMode && (
          <div
            style={{
              padding: "10px 15px",
              backgroundColor: "#fef08a",
              color: "#854d0e",
              fontSize: "0.8rem",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              zIndex: 2,
              borderBottom: "1px solid #eab308",
            }}
          >
            <AlertTriangle size={16} />
            Note: Scanned info can sometimes be inaccurate. Please double-check
            your ID Number.
          </div>
        )}

        <div
          style={{
            padding: "12px",
            color: isSuccess ? "#4ade80" : "#facc15",
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "0.9rem",
            background: "rgba(15, 23, 42, 0.9)",
            zIndex: 2,
            transition: "color 0.3s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {isSuccess && <CheckCircle size={20} />}
          {idType === "PhilID" && !isSuccess
            ? "Step 1: Align FRONT of National ID"
            : idType === "DriverLicense" && !isSuccess
              ? "Step 1: Align FRONT of Driver's License"
              : !isSuccess
                ? "Step 1: Take a clear photo of the FRONT of your ID"
                : scanFeedback}
        </div>

        {isAutoScanMode && !isSuccess && (
          <div
            style={{
              position: "absolute",
              top: "100px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              padding: "6px 16px",
              borderRadius: "20px",
              fontSize: "0.8rem",
              zIndex: 15,
              whiteSpace: "nowrap",
              backdropFilter: "blur(4px)",
            }}
          >
            {scanFeedback}
          </div>
        )}

        <div
          style={{ flex: 1, position: "relative", cursor: "crosshair" }}
          onTouchStart={!frozenImage ? handleTapToFocus : undefined}
          onClick={!frozenImage ? handleTapToFocus : undefined}
        >
          <style>{`
            @keyframes focusPulse {
              0% { transform: translate(-50%, -50%) scale(1.3); opacity: 0; }
              20% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
            }
            @keyframes scanLaser {
              0% { top: 0; }
              50% { top: 100%; }
              100% { top: 0; }
            }
          `}</style>

          {frozenImage ? (
            <img
              src={frozenImage}
              alt="Captured ID"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: "environment",
                advanced: [{ focusMode: "continuous" }],
              }}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}

          <div
            style={{
              position: "absolute",
              top: "45%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "85%",
              height: "220px",
              border: `3px solid ${isSuccess ? "#4ade80" : "rgba(16, 185, 129, 0.8)"}`,
              borderRadius: "12px",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
              pointerEvents: "none",
              overflow: "hidden",
              transition: "border-color 0.3s",
            }}
          >
            {isAutoScanMode && !isSuccess && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  width: "100%",
                  height: "2px",
                  backgroundColor: "#facc15",
                  boxShadow: "0 0 8px #facc15",
                  animation: "scanLaser 2.5s linear infinite",
                }}
              />
            )}
          </div>

          {showFocusRing && !frozenImage && (
            <div
              style={{
                position: "absolute",
                top: focusPoint.y,
                left: focusPoint.x,
                width: "60px",
                height: "60px",
                border: "2px solid #facc15",
                borderRadius: "8px",
                pointerEvents: "none",
                zIndex: 20,
                animation:
                  "focusPulse 1s cubic-bezier(0.1, 0.8, 0.3, 1) forwards",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  left: -2,
                  width: 10,
                  height: 10,
                  borderTop: "2px solid #facc15",
                  borderLeft: "2px solid #facc15",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderTop: "2px solid #facc15",
                  borderRight: "2px solid #facc15",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  left: -2,
                  width: 10,
                  height: 10,
                  borderBottom: "2px solid #facc15",
                  borderLeft: "2px solid #facc15",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderBottom: "2px solid #facc15",
                  borderRight: "2px solid #facc15",
                }}
              />
            </div>
          )}
        </div>

        {!isAutoScanMode && !frozenImage && (
          <div
            style={{
              position: "absolute",
              bottom: "40px",
              left: "0",
              right: "0",
              display: "flex",
              justifyContent: "center",
              zIndex: 5,
            }}
          >
            <button
              onClick={manualCapture}
              style={{
                width: "70px",
                height: "70px",
                borderRadius: "50%",
                background: "rgba(255, 255, 255, 0.5)",
                border: "4px solid #10b981",
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

  // SELFIE SCANNER
  if (step === "selfie-scan") {
    return (
      <div
        style={{
          position: "absolute",
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
          Step 2: Position face inside the circle. Tap to focus.
        </div>

        <div
          style={{ flex: 1, position: "relative", cursor: "crosshair" }}
          onTouchStart={handleTapToFocus}
          onClick={handleTapToFocus}
        >
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode: "user",
              advanced: [{ focusMode: "continuous" }],
            }}
            mirrored={true}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div
            style={{
              position: "absolute",
              top: "45%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "260px",
              height: "260px",
              border: "3px solid rgba(74, 222, 128, 0.8)",
              borderRadius: "50%",
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
              pointerEvents: "none",
            }}
          ></div>

          {showFocusRing && (
            <div
              style={{
                position: "absolute",
                top: focusPoint.y,
                left: focusPoint.x,
                width: "60px",
                height: "60px",
                border: "2px solid #facc15",
                borderRadius: "8px",
                pointerEvents: "none",
                zIndex: 20,
                animation:
                  "focusPulse 1s cubic-bezier(0.1, 0.8, 0.3, 1) forwards",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  left: -2,
                  width: 10,
                  height: 10,
                  borderTop: "2px solid #facc15",
                  borderLeft: "2px solid #facc15",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderTop: "2px solid #facc15",
                  borderRight: "2px solid #facc15",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  left: -2,
                  width: 10,
                  height: 10,
                  borderBottom: "2px solid #facc15",
                  borderLeft: "2px solid #facc15",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderBottom: "2px solid #facc15",
                  borderRight: "2px solid #facc15",
                }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "40px",
            left: "0",
            right: "0",
            display: "flex",
            justifyContent: "center",
            zIndex: 5,
          }}
        >
          <button
            onClick={manualCapture}
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
