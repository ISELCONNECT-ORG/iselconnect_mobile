import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Settings, User, Edit, Save, X } from "lucide-react";
import LinemanSettingsTab from "./LinemanSettingsTab";
import logo from "../assets/BG.png";
import { logSystemAction } from "../utils/logger";
import { translations } from "../components/translations";
import "../Lineman.css";
import LoadingScreen from "../components/LoadingScreen";

function LinemanProfileTab({ onLogout }) {
  const currentLang = localStorage.getItem("appLanguage") || "English";
  const t = translations[currentLang];

  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("profile");

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [editData, setEditData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    municipality_id: "",
    barangay_id: "",
    purok_sitio: "",
  });

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: dbUser } = await supabase
          .from("users")
          .select(
            `*, employees ( employee_id_no ), barangays ( id, name ), municipalities ( id, name )`,
          )
          .eq("id", user.id)
          .maybeSingle();
        const empId =
          dbUser?.employees?.[0]?.employee_id_no ||
          dbUser?.employees?.employee_id_no ||
          "N/A";
        const hasAddress =
          dbUser?.municipalities?.name || dbUser?.barangays?.name;
        const addressParts = [
          dbUser?.purok_sitio,
          dbUser?.barangays?.name,
          dbUser?.municipalities?.name,
          hasAddress ? "Isabela" : null,
        ].filter(Boolean);
        const fullAddress = hasAddress ? addressParts.join(", ") : "None";

        setUserProfile({
          id: user.id,
          email: user.email || dbUser?.email || "N/A",
          firstName: dbUser?.first_name ?? "",
          lastName: dbUser?.last_name ?? "",
          middleName: dbUser?.middle_name ?? "",
          mobileNumber: dbUser?.mobile_number ?? "N/A",
          employeeId: empId,
          address: fullAddress,
          municipality_id: dbUser?.municipality_id || "",
          barangay_id: dbUser?.barangay_id || "",
          purok_sitio: dbUser?.purok_sitio || "",
        });
      }
    } catch (error) {
      console.error("Error loading lineman profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchMunicipalities = async () => {
      const { data } = await supabase
        .from("municipalities")
        .select("id, name")
        .order("name");
      if (data) setMunicipalities(data);
    };
    fetchMunicipalities();
  }, []);

  useEffect(() => {
    const fetchBarangays = async () => {
      if (!editData.municipality_id) {
        setBarangays([]);
        return;
      }
      const { data } = await supabase
        .from("barangays")
        .select("id, name")
        .eq("municipality_id", editData.municipality_id)
        .order("name");
      if (data) setBarangays(data);
    };
    if (isEditing) fetchBarangays();
  }, [editData.municipality_id, isEditing]);

  const handleEditClick = () => {
    setEditData({
      first_name: userProfile.firstName,
      middle_name: userProfile.middleName,
      last_name: userProfile.lastName,
      municipality_id: userProfile.municipality_id,
      barangay_id: userProfile.barangay_id,
      purok_sitio: userProfile.purok_sitio,
    });
    setIsEditing(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "municipality_id") newData.barangay_id = "";
      return newData;
    });
  };

  const handleSaveProfile = async () => {
    if (
      !editData.first_name ||
      !editData.last_name ||
      !editData.municipality_id ||
      !editData.barangay_id
    ) {
      alert("First Name, Last Name, Municipality, and Barangay are required.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({
          first_name: editData.first_name.trim(),
          middle_name: editData.middle_name.trim() || null,
          last_name: editData.last_name.trim(),
          municipality_id: parseInt(editData.municipality_id),
          barangay_id: parseInt(editData.barangay_id),
          purok_sitio: editData.purok_sitio.trim() || null,
        })
        .eq("id", userProfile.id);
      if (error) throw error;
      await logSystemAction(
        "UPDATE_PROFILE",
        "Lineman updated their profile information.",
      );
      setIsEditing(false);
      setShowSuccessModal(true);
      await fetchUserData();
    } catch (err) {
      alert("Error updating profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingScreen message={t.loadingProfile} />;

  if (activeView === "settings") {
    return (
      <LinemanSettingsTab
        onBack={() => setActiveView("profile")}
        onLogout={onLogout}
      />
    );
  }

  const fullName =
    `${userProfile?.firstName ?? ""} ${userProfile?.middleName ?? ""} ${userProfile?.lastName ?? ""}`
      .replace(/\s+/g, " ")
      .trim() || "Lineman";

  return (
    <div
      className="pt-container page-transition"
      style={{
        height: "100vh",
        overflowY: "auto",
        paddingBottom: "150px",
        boxSizing: "border-box",
        position: "relative",
      }}
    >
      {showSuccessModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">{t.confirmChangesTitle}</h3>
            <p
              className="modal-text"
              dangerouslySetInnerHTML={{
                __html: t.confirmChangesText.replace(
                  "successfully",
                  "successfully<br/>",
                ),
              }}
            />
            <div className="modal-buttons">
              <button
                className="modal-btn confirm-btn"
                onClick={() => setShowSuccessModal(false)}
                style={{ backgroundColor: "#1b0b8c", width: "100%" }}
              >
                OK!
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="profile-header-bg"
        style={{
          background: `linear-gradient(rgba(255,255,255,0.2), rgba(255,255,255,0.6)), url(${logo})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="avatar-container">
          <User size={80} color="#1b0b8c" strokeWidth={1.5} />
        </div>
      </div>

      <div className="pt-info-wrapper">
        <h2 className="pt-name-heading">
          {isEditing ? t.editProfileTitle : fullName}
        </h2>

        {!isEditing ? (
          <>
            <div className="pt-data-grid page-transition">
              <div className="pt-data-row">
                <span className="pt-data-label">{t.employeeId}</span>
                <span className="pt-data-value">{userProfile?.employeeId}</span>
              </div>
              <div className="pt-data-row">
                <span className="pt-data-label">{t.emailLabel}</span>
                <span
                  className="pt-data-value"
                  style={{ wordBreak: "break-all" }}
                >
                  {userProfile?.email}
                </span>
              </div>
              <div className="pt-data-row">
                <span className="pt-data-label">{t.addressLabel}</span>
                <span
                  className="pt-data-value"
                  style={{
                    textTransform:
                      userProfile?.address === "None" ? "none" : "inherit",
                  }}
                >
                  {userProfile?.address}
                </span>
              </div>
              <div className="pt-data-row">
                <span className="pt-data-label">{t.contactLabel}</span>
                <span className="pt-data-value">
                  {userProfile?.mobileNumber}
                </span>
              </div>
            </div>

            <div className="profile-btn-row page-transition">
              <button onClick={handleEditClick} className="profile-btn-edit">
                <Edit size={20} /> {t.editProfileTitle}
              </button>
              <button
                onClick={() => setActiveView("settings")}
                className="profile-btn-settings"
              >
                <Settings size={20} /> {t.settingsTitle}
              </button>
            </div>
          </>
        ) : (
          <div className="pt-edit-form-wrapper page-transition">
            <div className="edit-input-group">
              <label>{t.firstName}</label>
              <input
                type="text"
                name="first_name"
                value={editData.first_name}
                onChange={handleInputChange}
                className="edit-input"
              />
            </div>
            <div className="edit-input-group">
              <label>{t.middleName}</label>
              <input
                type="text"
                name="middle_name"
                value={editData.middle_name}
                onChange={handleInputChange}
                className="edit-input"
              />
            </div>
            <div className="edit-input-group">
              <label>{t.lastName}</label>
              <input
                type="text"
                name="last_name"
                value={editData.last_name}
                onChange={handleInputChange}
                className="edit-input"
              />
            </div>
            <div className="edit-input-group">
              <label>{t.municipality}</label>
              <select
                name="municipality_id"
                value={editData.municipality_id}
                onChange={handleInputChange}
                className="edit-input custom-select"
              >
                <option value="" disabled>
                  {t.selectMunicipality}
                </option>
                {municipalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="edit-input-group">
              <label>{t.barangay}</label>
              <select
                name="barangay_id"
                value={editData.barangay_id}
                onChange={handleInputChange}
                className="edit-input custom-select"
                disabled={!editData.municipality_id}
              >
                <option value="" disabled>
                  {editData.municipality_id
                    ? t.selectBarangay
                    : t.selectMunicipalityFirst}
                </option>
                {barangays.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="edit-input-group">
              <label>{t.purokSitio}</label>
              <input
                type="text"
                name="purok_sitio"
                value={editData.purok_sitio}
                onChange={handleInputChange}
                className="edit-input"
              />
            </div>
            <div className="edit-actions">
              <button
                onClick={() => setIsEditing(false)}
                className="edit-cancel-btn"
                disabled={saving}
              >
                <X size={18} /> {t.cancelBtn}
              </button>
              <button
                onClick={handleSaveProfile}
                className="edit-save-btn"
                disabled={saving}
              >
                <Save size={18} /> {saving ? t.savingBtn : t.saveChangesBtn}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default LinemanProfileTab;
