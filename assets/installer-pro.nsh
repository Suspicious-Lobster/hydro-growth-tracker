; HydroGrowth Tracker Pro - Professional Installer Script
; Custom NSIS installer with branding and enhanced user experience

!include "MUI2.nsh"
!include "FileFunc.nsh"

; Installer branding
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_ICON "assets\icon.svg"
!define MUI_UNICON "assets\icon.svg"

; Welcome page customization
!define MUI_WELCOMEPAGE_TITLE "Welcome to HydroGrowth Tracker Pro"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of HydroGrowth Tracker Pro, the professional solution for hydroponic growth monitoring.$\r$\n$\r$\nFeatures:$\r$\n• Advanced growth analytics$\r$\n• Real-time monitoring$\r$\n• Professional reporting$\r$\n• Offline operation$\r$\n$\r$\nClick Next to continue."

; Finish page customization
!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TEXT "HydroGrowth Tracker Pro has been successfully installed on your computer.$\r$\n$\r$\nYou can now start monitoring your hydroponic systems with professional-grade tools.$\r$\n$\r$\nClick Finish to close this wizard."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${PRODUCT_NAME}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch HydroGrowth Tracker Pro"
!define MUI_FINISHPAGE_LINK "Visit our website for support and updates"
!define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/hydrotracker/hydro-growth-tracker"

; Custom installation messages
!define MUI_INSTFILESDLG_COLORS "00AA00 000000"
!define MUI_PROGRESSBAR_COLOR1 "00AA00"
!define MUI_PROGRESSBAR_COLOR2 "004400"

; Installation directory page
!define MUI_DIRECTORYPAGE_TEXT_TOP "Choose the folder in which to install HydroGrowth Tracker Pro.$\r$\n$\r$\nRecommended: Keep the default location for best performance."

; Components page customization
!define MUI_COMPONENTSPAGE_TEXT_TOP "Select the components you want to install.$\r$\n$\r$\nAll components are recommended for the best experience."

; Custom installer macros
!macro customInstall
    DetailPrint "Setting up HydroGrowth Tracker Pro..."
    DetailPrint "Creating database directory..."
    CreateDirectory "$INSTDIR\database"
    DetailPrint "Creating uploads directory..."  
    CreateDirectory "$INSTDIR\uploads"
    DetailPrint "Setting up configuration..."
    DetailPrint "Configuring SQLite database..."
    DetailPrint "Installation complete - Ready for professional hydroponic monitoring!"
!macroend

; Custom uninstaller
!macro customUnInstall
    DetailPrint "Cleaning up HydroGrowth Tracker Pro..."
    ; Note: We preserve user data (database and uploads) by default
    ; Uncomment the lines below if you want to remove all user data
    ; RMDir /r "$INSTDIR\database"
    ; RMDir /r "$INSTDIR\uploads"
    DetailPrint "Uninstallation complete"
!macroend

; Custom header info
!macro customHeader
    !define MUI_HEADERIMAGE
    !define MUI_HEADERIMAGE_RIGHT
!macroend

; Custom functions
Function .onInit
    ; Display loading message
    DetailPrint "Initializing HydroGrowth Tracker Pro installer..."
FunctionEnd

Function .onInstSuccess
    ; Custom success message
    MessageBox MB_ICONINFORMATION "Installation completed successfully!$\r$\n$\r$\nHydroGrowth Tracker Pro is ready to help you monitor your hydroponic systems."
FunctionEnd

Function .onInstFailed
    ; Custom failure message
    MessageBox MB_ICONSTOP "Installation failed. Please try again or contact support."
FunctionEnd

; Uninstaller customization
Function un.onInit
    MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove HydroGrowth Tracker Pro and all of its components?" /SD IDYES IDYES +2
    Abort
FunctionEnd

Function un.onUninstSuccess
    MessageBox MB_ICONINFORMATION "HydroGrowth Tracker Pro has been successfully removed from your computer."
FunctionEnd
