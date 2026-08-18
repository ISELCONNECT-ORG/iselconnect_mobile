import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../supabaseClient";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  CheckCircle,
  Circle,
  ShieldCheck,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import logo from "../assets/ISELCONNECT.png";
import { logSystemAction } from "../utils/logger";

import IdVerification from "./IdVerification";
import EmailOtpVerification from "./EmailOtpVerification";

const DUMMY_IMAGE =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

const base64ToBlob = (base64, mimeType = "image/jpeg") => {
  const byteCharacters = atob(base64.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
};

const validatePassword = (password) => {
  const isValid = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/.test(
    password,
  );
  if (!isValid) return "Password must meet all requirements below.";
  return null;
};

// --- SEARCHABLE DROPDOWN COMPONENT ---
const SearchableDropdown = ({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  name,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const selectedOption = options.find(
    (opt) => opt.id.toString() === value?.toString(),
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const displayValue = isOpen
    ? searchTerm
    : selectedOption
      ? selectedOption.name
      : "";

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        name={name}
        className="auth-input"
        style={{
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "text",
          width: "100%",
          boxSizing: "border-box",
          padding: "14px 20px",
        }}
        placeholder={placeholder}
        value={displayValue}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        autoComplete="off"
      />
      <div
        style={{
          position: "absolute",
          right: "15px",
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
        }}
      >
        <ChevronDown size={20} color="#1b0b8c" />
      </div>
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            backgroundColor: "#ffffff",
            border: "2px solid #1b0b8c",
            borderRadius: "10px",
            maxHeight: "200px",
            overflowY: "auto",
            zIndex: 9999,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            marginTop: "5px",
            padding: "5px",
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.id}
                onClick={() => {
                  onChange({ target: { name, value: opt.id } });
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                style={{
                  padding: "10px 15px",
                  cursor: "pointer",
                  borderRadius: "8px",
                  color: "#1e293b",
                  fontWeight: selectedOption?.id === opt.id ? "bold" : "normal",
                  backgroundColor:
                    selectedOption?.id === opt.id ? "#f1f5f9" : "transparent",
                }}
              >
                {opt.name}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: "10px 15px",
                color: "#94a3b8",
                textAlign: "center",
              }}
            >
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function SignUp({ onBack }) {
  const [signupStep, setSignupStep] = useState("privacy");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [formData, setFormData] = useState({
    idType: "PhilID",
    idNumber: "",
    email: "",
    password: "",
    mobileNumber: "",
    firstName: "",
    middleName: "",
    lastName: "",
    purokSitio: "",
    otherLocation: "",
    municipality_id: "",
    barangay_id: "",
    otp: "",
  });

  const [capturedIdImage, setCapturedIdImage] = useState(null);
  const [capturedSelfieImage, setCapturedSelfieImage] = useState(null);

  useEffect(() => {
    if (showSuccessModal) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showSuccessModal]);

  useEffect(() => {
    const fetchMunicipalities = async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("id, name")
        .order("name", { ascending: true });

      if (data && !error) {
        const otherOption = data.find(
          (m) => m.name === "Other / Outside Coverage Area",
        );
        const regularMunicipalities = data.filter(
          (m) => m.name !== "Other / Outside Coverage Area",
        );

        if (otherOption) {
          setMunicipalities([otherOption, ...regularMunicipalities]);
        } else {
          setMunicipalities(data);
        }
      }
    };
    fetchMunicipalities();
  }, []);

  useEffect(() => {
    const fetchBarangays = async () => {
      if (!formData.municipality_id) {
        setBarangays([]);
        return;
      }
      const { data, error } = await supabase
        .from("barangays")
        .select("id, name")
        .eq("municipality_id", formData.municipality_id)
        .order("name", { ascending: true });
      if (data && !error) {
        setBarangays(data);
        if (data.length === 1 && data[0].name.includes("N/A")) {
          setFormData((prev) => ({
            ...prev,
            barangay_id: data[0].id.toString(),
          }));
        }
      }
    };
    fetchBarangays();
  }, [formData.municipality_id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "municipality_id") newData.barangay_id = "";
      return newData;
    });
  };

  const isOtherMunicipality =
    municipalities.find(
      (m) => m.id.toString() === formData.municipality_id.toString(),
    )?.name === "Other / Outside Coverage Area";

  const handleIdCaptured = (imageSrc, parsedData) => {
    setCapturedIdImage(imageSrc);
    setFormData((prev) => ({
      ...prev,
      idNumber: parsedData.idNumber || prev.idNumber,
      firstName: parsedData.firstName || prev.firstName,
      lastName: parsedData.lastName || prev.lastName,
    }));
    setSignupStep("selfie-scan");
  };

  const handleSelfieCaptured = (imageSrc) => {
    setCapturedSelfieImage(imageSrc);
    setSignupStep("form");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const passwordError = validatePassword(formData.password);
      if (passwordError) throw new Error(passwordError);
      if (isOtherMunicipality && !formData.otherLocation.trim())
        throw new Error("Please provide your City / Province.");
      if (!formData.idNumber.trim())
        throw new Error("Please provide your ID Number.");

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
      });

      if (authError) throw authError;
      if (!authData?.user?.id)
        throw new Error("Failed to create account. Email might already exist.");

      setSignupStep("otp");
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        email: formData.email.trim(),
        token: formData.otp.trim(),
        type: "signup",
      });

      if (otpError) throw otpError;
      if (!otpData?.user?.id)
        throw new Error("Verification failed. Please try again.");

      const userId = otpData.user.id;

      const idBlob = base64ToBlob(capturedIdImage || DUMMY_IMAGE);
      const idFileName = `${userId}/id-${Date.now()}.jpg`;
      const { error: idUploadError } = await supabase.storage
        .from("verification_photos")
        .upload(idFileName, idBlob, { contentType: "image/jpeg" });
      if (idUploadError)
        throw new Error("ID Upload Blocked: " + idUploadError.message);
      const idPhotoUrl = supabase.storage
        .from("verification_photos")
        .getPublicUrl(idFileName).data.publicUrl;

      const selfieBlob = base64ToBlob(capturedSelfieImage || DUMMY_IMAGE);
      const selfieFileName = `${userId}/selfie-${Date.now()}.jpg`;
      const { error: selfieUploadError } = await supabase.storage
        .from("verification_photos")
        .upload(selfieFileName, selfieBlob, { contentType: "image/jpeg" });
      if (selfieUploadError)
        throw new Error("Selfie Upload Blocked: " + selfieUploadError.message);
      const selfieUrl = supabase.storage
        .from("verification_photos")
        .getPublicUrl(selfieFileName).data.publicUrl;

      let finalPurokSitio = formData.purokSitio.trim();
      if (isOtherMunicipality && formData.otherLocation.trim()) {
        finalPurokSitio = finalPurokSitio
          ? `${finalPurokSitio}, ${formData.otherLocation.trim()}`
          : formData.otherLocation.trim();
      }

      const { error: userError } = await supabase.from("users").upsert(
        [
          {
            id: userId,
            first_name: formData.firstName.trim(),
            middle_name: formData.middleName.trim() || null,
            last_name: formData.lastName.trim(),
            purok_sitio: finalPurokSitio || null,
            email: formData.email.trim(),
            mobile_number: formData.mobileNumber.trim(),
            role_id: 7,
            municipality_id: parseInt(formData.municipality_id),
            barangay_id: parseInt(formData.barangay_id),
          },
        ],
        { onConflict: "id" },
      );
      if (userError) throw userError;

      const { error: kycError } = await supabase
        .from("user_verifications")
        .insert([
          {
            user_id: userId,
            id_type: formData.idType,
            id_number: formData.idNumber.trim(),
            id_photo_url: idPhotoUrl,
            selfie_photo_url: selfieUrl,
            verification_status: "pending",
          },
        ]);
      if (kycError) throw kycError;

      localStorage.setItem("isNewResident", "true");
      await logSystemAction(
        "USER_SIGNUP",
        `Resident created account and submitted eKYC photos.`,
      );

      setShowSuccessModal(true);
    } catch (error) {
      if (
        (error.code === "23505" || error.status === 409) &&
        error.message?.includes("id_number")
      ) {
        setErrorMsg("This ID Number is already registered to another account.");
      } else if (error.code === "23505" || error.status === 409) {
        setErrorMsg("Conflict: This ID Number or Email is already registered.");
      } else {
        setErrorMsg(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackNavigation = () => {
    if (signupStep === "otp") return;
    if (signupStep === "form") setSignupStep("selfie-scan");
    else if (signupStep === "selfie-scan") setSignupStep("id-scan");
    else if (signupStep === "id-scan") setSignupStep("id-select");
    else if (signupStep === "id-select") setSignupStep("privacy");
    else onBack();
  };

  const hasLength = formData.password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(formData.password);
  const hasNumber = /\d/.test(formData.password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(formData.password);

  return (
    <div className="auth-layout">
      {showSuccessModal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              zIndex: 999999,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                padding: "30px",
                borderRadius: "20px",
                width: "90%",
                maxWidth: "400px",
                textAlign: "center",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                animation: "slideUpFade 0.3s ease-out",
              }}
            >
              <CheckCircle
                size={60}
                color="#16a34a"
                style={{ margin: "0 auto 15px auto" }}
              />
              <h3
                style={{
                  color: "#1e293b",
                  fontSize: "1.5rem",
                  fontWeight: "900",
                  margin: "0 0 10px 0",
                }}
              >
                Verification Complete!
              </h3>
              <p
                style={{
                  color: "#475569",
                  fontSize: "0.9rem",
                  lineHeight: "1.5",
                  margin: "0 0 25px 0",
                }}
              >
                Your account is currently pending admin approval. You can now
                log in.
              </p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  onBack();
                }}
                style={{
                  backgroundColor: "#1b0b8c",
                  color: "#fff",
                  width: "100%",
                  padding: "12px",
                  borderRadius: "25px",
                  border: "none",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  cursor: "pointer",
                }}
              >
                Return to Login
              </button>
            </div>
          </div>,
          document.body,
        )}

      <div className="auth-top-section auth-bg-photo">
        {signupStep !== "otp" && (
          <button
            className="auth-back-btn"
            type="button"
            style={{
              zIndex: 10,
              animation: "contentFade 0.3s ease-out",
            }}
            onClick={handleBackNavigation}
          >
            <ChevronLeft size={24} strokeWidth={2.5} color="#1e1b4b" />
          </button>
        )}
        <img src={logo} alt="ISELCONNECT Logo" className="auth-logo-img" />
      </div>

      <div className="auth-bottom-section">
        <div className="auth-title-container">
          <h2 className="auth-form-title">
            <span style={{ color: "#facc15" }}>RESIDENTS</span>{" "}
            <span style={{ color: "#ffffff" }}>SIGN UP</span>
          </h2>
          <div className="auth-title-underline"></div>
        </div>

        {errorMsg && <div className="error-alert">{errorMsg}</div>}

        {/* STEP 1: PRIVACY ACT */}
        {signupStep === "privacy" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              animation: "contentFade 0.3s ease-out",
            }}
          >
            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "20px",
                borderRadius: "15px",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "15px",
                  color: "#1b0b8c",
                }}
              >
                <ShieldCheck size={28} />
                <h3
                  style={{ margin: 0, fontWeight: "900", fontSize: "1.1rem" }}
                >
                  Data Privacy & Verification
                </h3>
              </div>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#334155",
                  lineHeight: "1.6",
                  marginBottom: "10px",
                  textAlign: "justify",
                }}
              >
                In compliance with the <strong>Republic Act No. 10173</strong>{" "}
                or the Data Privacy Act of 2012, ISELCONNECT strictly protects
                your personal information.
              </p>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#334155",
                  lineHeight: "1.6",
                  marginBottom: "10px",
                  textAlign: "justify",
                }}
              >
                To maintain a secure <strong>"One Account Per Person"</strong>{" "}
                policy, you will be required to provide a Valid Government ID
                and a Live Selfie. This prevents duplicate accounts and ensures
                accurate reporting.
              </p>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#334155",
                  lineHeight: "1.6",
                  margin: 0,
                  textAlign: "justify",
                }}
              >
                Your data will never be shared with unverified third parties and
                is exclusively handled by authorized ISELCO-1 personnel.
              </p>
            </div>
            <div style={{ marginTop: "20px", flexShrink: 0 }}>
              <button
                type="button"
                className="auth-submit-btn"
                onClick={() => setSignupStep("id-select")}
                style={{ backgroundColor: "#16a34a" }}
              >
                I Agree & Proceed
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SELECT ID TYPE */}
        {signupStep === "id-select" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              animation: "contentFade 0.3s ease-out",
            }}
          >
            <div
              style={{
                backgroundColor: "#f8fafc",
                padding: "20px",
                borderRadius: "15px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CreditCard
                size={48}
                color="#1b0b8c"
                style={{ marginBottom: "15px" }}
              />
              <h3
                style={{
                  color: "#1e293b",
                  margin: "0 0 10px 0",
                  fontWeight: "900",
                }}
              >
                Select Valid ID
              </h3>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "#64748b",
                  textAlign: "center",
                  marginBottom: "20px",
                }}
              >
                Choose the ID you will scan for verification.
              </p>

              <div className="auth-input-group" style={{ width: "100%" }}>
                <select
                  name="idType"
                  value={formData.idType}
                  onChange={handleInputChange}
                  className="auth-input"
                  style={{ textAlign: "center", fontWeight: "bold" }}
                >
                  <option value="PhilID">National ID (PhilSys)</option>
                  <option value="DriverLicense">Driver's License</option>
                  <option value="UMID">UMID</option>
                  <option value="Passport">Passport</option>
                  <option value="Postal">Postal ID</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: "20px", flexShrink: 0 }}>
              <button
                type="button"
                className="auth-submit-btn"
                onClick={() => setSignupStep("id-scan")}
              >
                Proceed to Camera Scanner
              </button>
            </div>
          </div>
        )}

        {/* STEPS 3 & 4: IMPORTED CAMERA COMPONENT */}
        {(signupStep === "id-scan" || signupStep === "selfie-scan") && (
          <IdVerification
            step={signupStep}
            onIdCaptured={handleIdCaptured}
            onSelfieCaptured={handleSelfieCaptured}
          />
        )}

        {/* STEP 5: MAIN REGISTRATION FORM */}
        {signupStep === "form" && (
          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              animation: "contentFade 0.3s ease-out",
            }}
          >
            {/* 🌟 FIXED: Removed inline flex/overflow restrictions so the whole page scrolls */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                marginBottom: "15px",
              }}
            >
              <div className="auth-input-group">
                <input
                  type="text"
                  name="firstName"
                  placeholder="First Name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="auth-input"
                  style={{ padding: "14px 20px" }}
                />
              </div>

              <div className="auth-input-group">
                <input
                  type="text"
                  name="middleName"
                  placeholder="Middle Name"
                  value={formData.middleName}
                  onChange={handleInputChange}
                  className="auth-input"
                  style={{ padding: "14px 20px" }}
                />
              </div>

              <div className="auth-input-group">
                <input
                  type="text"
                  name="lastName"
                  placeholder="Last Name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="auth-input"
                  style={{ padding: "14px 20px" }}
                />
              </div>

              <div className="auth-input-group">
                <input
                  type="text"
                  name="idNumber"
                  placeholder="ID Number"
                  value={formData.idNumber}
                  onChange={handleInputChange}
                  required
                  className="auth-input"
                  style={{ padding: "14px 20px" }}
                />
              </div>

              <div className="auth-input-group">
                <input
                  type="text"
                  name="purokSitio"
                  placeholder="Purok"
                  value={formData.purokSitio}
                  onChange={handleInputChange}
                  className="auth-input"
                  style={{ padding: "14px 20px" }}
                />
              </div>

              <div className="auth-input-group">
                <SearchableDropdown
                  name="barangay_id"
                  options={barangays}
                  value={formData.barangay_id}
                  onChange={handleInputChange}
                  placeholder={
                    !formData.municipality_id
                      ? "Select Municipality First"
                      : "Barangay"
                  }
                  disabled={!formData.municipality_id || isOtherMunicipality}
                />
              </div>

              <div className="auth-input-group">
                <SearchableDropdown
                  name="municipality_id"
                  options={municipalities}
                  value={formData.municipality_id}
                  onChange={handleInputChange}
                  placeholder="Municipality"
                />
              </div>

              {isOtherMunicipality && (
                <div className="auth-input-group">
                  <input
                    type="text"
                    name="otherLocation"
                    placeholder="City / Province"
                    value={formData.otherLocation}
                    onChange={handleInputChange}
                    required
                    className="auth-input"
                    style={{ padding: "14px 20px" }}
                  />
                </div>
              )}

              <div className="auth-input-group">
                <input
                  type="tel"
                  name="mobileNumber"
                  placeholder="Mobile Number"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  required
                  className="auth-input"
                  style={{ padding: "14px 20px" }}
                />
              </div>

              <div className="auth-input-group">
                <input
                  type="email"
                  name="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="auth-input"
                  style={{ padding: "14px 20px" }}
                />
              </div>

              <div className="auth-input-group">
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="auth-input"
                    style={{ padding: "14px 20px" }}
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color="#1e1b4b" />
                    ) : (
                      <Eye size={20} color="#1e1b4b" />
                    )}
                  </button>
                </div>
                <div
                  style={{
                    marginTop: "6px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px",
                    paddingLeft: "10px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: hasLength ? "#4ade80" : "#cbd5e1",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: "600",
                    }}
                  >
                    {hasLength ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Circle size={12} />
                    )}{" "}
                    8+ chars
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: hasLetter ? "#4ade80" : "#cbd5e1",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: "600",
                    }}
                  >
                    {hasLetter ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Circle size={12} />
                    )}{" "}
                    1+ letter
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: hasNumber ? "#4ade80" : "#cbd5e1",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: "600",
                    }}
                  >
                    {hasNumber ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Circle size={12} />
                    )}{" "}
                    1+ number
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: hasSpecial ? "#4ade80" : "#cbd5e1",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontWeight: "600",
                    }}
                  >
                    {hasSpecial ? (
                      <CheckCircle size={12} />
                    ) : (
                      <Circle size={12} />
                    )}{" "}
                    1+ special
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "auto",
                flexShrink: 0,
                paddingBottom: "10px",
              }}
            >
              <button
                type="submit"
                disabled={loading}
                className="auth-submit-btn-mockup"
              >
                {loading ? "PROCESSING..." : "SUBMIT"}
              </button>
            </div>
          </form>
        )}

        {/* STEP 6: IMPORTED EMAIL OTP COMPONENT */}
        {signupStep === "otp" && (
          <EmailOtpVerification
            email={formData.email}
            otp={formData.otp}
            onOtpChange={handleInputChange}
            onVerifyOTP={handleVerifyOTP}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}

export default SignUp;
