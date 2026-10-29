import React from "react";
import { setTheme, useTheme, type Theme } from "../theme";

export default function AppearanceSettings() {
  const theme = useTheme();
  const [notice, setNotice] = React.useState("");
  function choose(value: Theme) {
    const saved = setTheme(value);
    setNotice(saved ? `${value === "dark" ? "Dark" : "Light"} theme applied and saved.` : "Theme applied. Browser storage is unavailable, so this choice cannot be saved.");
  }
  return <>
    <div className="settings-panel-header"><div><h2>Appearance</h2><p>Choose how Star Stream looks. Changes apply immediately and are saved in this browser.</p></div></div>
    <fieldset className="theme-options">
      <legend>Website theme</legend>
      {(["dark", "light"] as const).map(value => <label className={`theme-option${theme === value ? " is-selected" : ""}`} key={value}>
        <span className={`theme-preview theme-preview--${value}`} aria-hidden="true"><span className="theme-preview-sidebar" /><span className="theme-preview-main"><span className="theme-preview-header" /><span className="theme-preview-cards"><i /><i /></span><span className="theme-preview-table" /></span></span>
        <span className="theme-option-title"><input type="radio" name="website-theme" value={value} checked={theme === value} onChange={() => choose(value)} /><strong>{value === "dark" ? "Dark" : "Light"}</strong>{value === "dark" && <span className="theme-default">Default</span>}</span>
        <span className="theme-option-description">{value === "dark" ? "Deep backgrounds with soft, bright text." : "Bright surfaces with clear, dark text."}</span>
      </label>)}
    </fieldset>
    <p className="settings-help" role="status">{notice || "You can change your theme at any time."}</p>
  </>;
}
