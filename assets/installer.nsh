; Custom NSIS installer script for Hydro Growth Tracker
; This file provides additional customization for the installer

; Custom installer strings
LangString welcome ${LANG_ENGLISH} "Welcome to the Hydro Growth Tracker Setup Wizard"
LangString finish ${LANG_ENGLISH} "Hydro Growth Tracker has been successfully installed.$\r$\n$\r$\nClick Finish to complete the installation."

; Custom page
!macro customInstall
    DetailPrint "Setting up Hydro Growth Tracker..."
    DetailPrint "Creating database directory..."
    CreateDirectory "$INSTDIR\database"
    DetailPrint "Creating uploads directory..."
    CreateDirectory "$INSTDIR\uploads"
    DetailPrint "Setting up configuration..."
!macroend

; Custom uninstaller
!macro customUnInstall
    DetailPrint "Cleaning up Hydro Growth Tracker..."
    ; Note: We preserve user data (database and uploads) by default
    ; Uncomment the lines below if you want to remove all user data
    ; RMDir /r "$INSTDIR\database"
    ; RMDir /r "$INSTDIR\uploads"
!macroend

; Custom header info
!macro customHeader
    !define MUI_HEADERIMAGE
    !define MUI_HEADERIMAGE_RIGHT
    !define MUI_HEADERIMAGE_BITMAP "${BUILD_RESOURCES_DIR}\header.bmp"
    !define MUI_WELCOMEFINISHPAGE_BITMAP "${BUILD_RESOURCES_DIR}\wizard.bmp"
!macroend

; Installation directory customization
!macro customInstallMode
    ; Set default installation directory
    StrCpy $INSTDIR "$LOCALAPPDATA\HydroGrowthTracker"
!macroend

; Finish page customization
!macro customFinishPage
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_TEXT "Launch Hydro Growth Tracker"
    !define MUI_FINISHPAGE_RUN_FUNCTION "LaunchApp"
    !define MUI_FINISHPAGE_LINK "Visit our website for support and updates"
    !define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/Suspicious-Lobster/hydro-growth-tracker"
!macroend

; Function to launch the app
Function LaunchApp
    ExecShell "open" "$INSTDIR\Hydro Growth Tracker.exe"
FunctionEnd

; Custom messages
!macro customRemoveFiles
    DetailPrint "Hydro Growth Tracker will now be removed from your computer."
!macroend
