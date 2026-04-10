; BrewBar POS — Inno Setup Installer
; Replicates WiX MSI functionality: deployment mode, business setup, JWT secret,
; bootstrap.json, deployment.json, shortcuts, and data deletion options.

#define MyAppName "BrewBar POS"
#define MyAppPublisher "BrewBar"
#define MyAppExeName "BrewBar POS.exe"
#define MyAppURL "https://brewbar.com"

; Version is passed via /DMyAppVersion=x.y.z on the ISCC command line.
; Falls back to 1.0.0 for local dev builds.
#ifndef MyAppVersion
  #define MyAppVersion "1.1.0"
#endif

[Setup]
AppId={{8F4E2A1B-3C5D-4E6F-A7B8-9C0D1E2F3A4B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\BrewBarPOS
DefaultGroupName={#MyAppName}
LicenseFile=License.rtf
OutputDir=..\build\installer
OutputBaseFilename=BrewBarPOS-{#MyAppVersion}-setup
Compression=lzma2/ultra64
SolidCompression=yes
; Allow installation on both x64 and x86 machines.
; The Electron + .NET payload is currently win-x64 only — if targeting
; 32-bit POS hardware, rebuild the API with -r win-x86 and Electron for ia32.
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=app.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
WizardStyle=modern
PrivilegesRequired=admin
CloseApplications=force
CloseApplicationsFilter=BrewBar POS.exe,BrewBar.API.exe

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\build\electron\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; Remove leftover bootstrap.json from previous installs so stale credentials
; don't get re-consumed on upgrade. A fresh one is written if the user fills
; in the business setup page.
Type: files; Name: "{app}\resources\api\bootstrap.json"

[UninstallDelete]
Type: files; Name: "{app}\resources\api\bootstrap.json"
Type: files; Name: "{app}\resources\api\appsettings.Desktop.local.json"
Type: files; Name: "{app}\deployment.json"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent

; ─── Custom wizard pages ─────────────────────────────────────────────────────

[Code]
var
  DeployModePage: TWizardPage;
  DeployModeStandalone: TNewRadioButton;
  DeployModeTerminal: TNewRadioButton;
  ApiUrlLabel: TNewStaticText;
  ApiUrlEdit: TNewEdit;

  BusinessPage: TWizardPage;
  StoreNameEdit: TNewEdit;
  TaxRateEdit: TNewEdit;
  CurrencyCombo: TNewComboBox;
  AdminNameEdit: TNewEdit;
  AdminEmailEdit: TNewEdit;
  AdminPasswordEdit: TPasswordEdit;
  AdminPinEdit: TPasswordEdit;

  ShowCredentialsCheckbox: TNewCheckBox;

  DataOptionsPage: TWizardPage;
  DeleteDataCheckbox: TNewCheckBox;

// ─── Helper: JSON-escape a string ──────────────────────────────────────────
function JsonEscape(const S: string): string;
var
  I: Integer;
  C: Char;
begin
  Result := '';
  for I := 1 to Length(S) do
  begin
    C := S[I];
    if C = '"' then
      Result := Result + '\"'
    else if C = '\' then
      Result := Result + '\\'
    else if C = Chr(8) then
      Result := Result + '\b'
    else if C = Chr(9) then
      Result := Result + '\t'
    else if C = Chr(10) then
      Result := Result + '\n'
    else if C = Chr(13) then
      Result := Result + '\r'
    else if C = Chr(12) then
      Result := Result + '\f'
    else
      Result := Result + C;
  end;
end;

// ─── Helper: Generate a random base64 string for JWT secret ────────────────
function GenerateRandomKey(Len: Integer): string;
var
  I: Integer;
  CharSet: string;
begin
  CharSet := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  Result := '';
  for I := 1 to Len do
    Result := Result + CharSet[Random(Length(CharSet)) + 1];
end;

// ─── Deploy Mode page ──────────────────────────────────────────────────────
procedure CreateDeployModePage;
var
  Lbl: TNewStaticText;
begin
  DeployModePage := CreateCustomPage(wpSelectDir,
    'Deployment Mode',
    'Choose how this terminal will connect to the BrewBar backend.');

  DeployModeStandalone := TNewRadioButton.Create(DeployModePage);
  DeployModeStandalone.Parent := DeployModePage.Surface;
  DeployModeStandalone.Top := 16;
  DeployModeStandalone.Left := 0;
  DeployModeStandalone.Width := DeployModePage.SurfaceWidth;
  DeployModeStandalone.Caption := 'Standalone — runs its own local server and database (single machine)';
  DeployModeStandalone.Checked := True;

  DeployModeTerminal := TNewRadioButton.Create(DeployModePage);
  DeployModeTerminal.Parent := DeployModePage.Surface;
  DeployModeTerminal.Top := 48;
  DeployModeTerminal.Left := 0;
  DeployModeTerminal.Width := DeployModePage.SurfaceWidth;
  DeployModeTerminal.Caption := 'Terminal — connects to an existing BrewBar server on your network';

  ApiUrlLabel := TNewStaticText.Create(DeployModePage);
  ApiUrlLabel.Parent := DeployModePage.Surface;
  ApiUrlLabel.Top := 96;
  ApiUrlLabel.Left := 0;
  ApiUrlLabel.Caption := 'Server API URL (terminal mode only):';

  ApiUrlEdit := TNewEdit.Create(DeployModePage);
  ApiUrlEdit.Parent := DeployModePage.Surface;
  ApiUrlEdit.Top := 116;
  ApiUrlEdit.Left := 0;
  ApiUrlEdit.Width := DeployModePage.SurfaceWidth;
  ApiUrlEdit.Text := 'https://your-server.com';

  Lbl := TNewStaticText.Create(DeployModePage);
  Lbl.Parent := DeployModePage.Surface;
  Lbl.Top := 142;
  Lbl.Left := 0;
  Lbl.Caption := 'e.g. https://pos-api.yourdomain.com or http://192.168.1.100:5000';
  Lbl.Font.Size := 7;
end;

// ─── Toggle password/PIN visibility ───────────────────────────────────────
procedure ShowCredentialsClick(Sender: TObject);
var
  PwdChar: Longint;
  TmpPwd, TmpPin: string;
begin
  if ShowCredentialsCheckbox.Checked then
    PwdChar := 0
  else
    PwdChar := Ord('*');
  // EM_SETPASSWORDCHAR = $00CC
  SendMessage(AdminPasswordEdit.Handle, $00CC, PwdChar, 0);
  SendMessage(AdminPinEdit.Handle, $00CC, PwdChar, 0);
  // Force redraw by resetting text
  TmpPwd := AdminPasswordEdit.Text;
  AdminPasswordEdit.Text := '';
  AdminPasswordEdit.Text := TmpPwd;
  TmpPin := AdminPinEdit.Text;
  AdminPinEdit.Text := '';
  AdminPinEdit.Text := TmpPin;
end;

// ─── Business Setup page (standalone only) ─────────────────────────────────
procedure CreateBusinessPage;
var
  Lbl: TNewStaticText;
  Y: Integer;
begin
  BusinessPage := CreateCustomPage(DeployModePage.ID,
    'Business Setup',
    'Configure your business details and admin account.');

  Y := 8;

  Lbl := TNewStaticText.Create(BusinessPage);
  Lbl.Parent := BusinessPage.Surface;
  Lbl.Top := Y;
  Lbl.Left := 0;
  Lbl.Caption := 'Store Name:';
  StoreNameEdit := TNewEdit.Create(BusinessPage);
  StoreNameEdit.Parent := BusinessPage.Surface;
  StoreNameEdit.Top := Y;
  StoreNameEdit.Left := 120;
  StoreNameEdit.Width := 260;
  StoreNameEdit.Text := 'BrewBar';
  Y := Y + 30;

  Lbl := TNewStaticText.Create(BusinessPage);
  Lbl.Parent := BusinessPage.Surface;
  Lbl.Top := Y;
  Lbl.Left := 0;
  Lbl.Caption := 'Tax Rate (%):';
  TaxRateEdit := TNewEdit.Create(BusinessPage);
  TaxRateEdit.Parent := BusinessPage.Surface;
  TaxRateEdit.Top := Y;
  TaxRateEdit.Left := 120;
  TaxRateEdit.Width := 60;
  TaxRateEdit.Text := '15';
  Y := Y + 30;

  Lbl := TNewStaticText.Create(BusinessPage);
  Lbl.Parent := BusinessPage.Surface;
  Lbl.Top := Y;
  Lbl.Left := 0;
  Lbl.Caption := 'Currency:';
  CurrencyCombo := TNewComboBox.Create(BusinessPage);
  CurrencyCombo.Parent := BusinessPage.Surface;
  CurrencyCombo.Top := Y;
  CurrencyCombo.Left := 120;
  CurrencyCombo.Width := 80;
  CurrencyCombo.Style := csDropDownList;
  CurrencyCombo.Items.Add('SCR');
  CurrencyCombo.Items.Add('USD');
  CurrencyCombo.Items.Add('EUR');
  CurrencyCombo.Items.Add('GBP');
  CurrencyCombo.ItemIndex := 0;
  Y := Y + 40;

  // Admin account section
  Lbl := TNewStaticText.Create(BusinessPage);
  Lbl.Parent := BusinessPage.Surface;
  Lbl.Top := Y;
  Lbl.Left := 0;
  Lbl.Caption := 'Admin Account (required)';
  Lbl.Font.Style := [fsBold];
  Y := Y + 24;

  Lbl := TNewStaticText.Create(BusinessPage);
  Lbl.Parent := BusinessPage.Surface;
  Lbl.Top := Y;
  Lbl.Left := 0;
  Lbl.Caption := 'Name:';
  AdminNameEdit := TNewEdit.Create(BusinessPage);
  AdminNameEdit.Parent := BusinessPage.Surface;
  AdminNameEdit.Top := Y;
  AdminNameEdit.Left := 120;
  AdminNameEdit.Width := 260;
  Y := Y + 30;

  Lbl := TNewStaticText.Create(BusinessPage);
  Lbl.Parent := BusinessPage.Surface;
  Lbl.Top := Y;
  Lbl.Left := 0;
  Lbl.Caption := 'Email:';
  AdminEmailEdit := TNewEdit.Create(BusinessPage);
  AdminEmailEdit.Parent := BusinessPage.Surface;
  AdminEmailEdit.Top := Y;
  AdminEmailEdit.Left := 120;
  AdminEmailEdit.Width := 260;
  Y := Y + 30;

  Lbl := TNewStaticText.Create(BusinessPage);
  Lbl.Parent := BusinessPage.Surface;
  Lbl.Top := Y;
  Lbl.Left := 0;
  Lbl.Caption := 'Password:';
  AdminPasswordEdit := TPasswordEdit.Create(BusinessPage);
  AdminPasswordEdit.Parent := BusinessPage.Surface;
  AdminPasswordEdit.Top := Y;
  AdminPasswordEdit.Left := 120;
  AdminPasswordEdit.Width := 260;
  Y := Y + 30;

  Lbl := TNewStaticText.Create(BusinessPage);
  Lbl.Parent := BusinessPage.Surface;
  Lbl.Top := Y;
  Lbl.Left := 0;
  Lbl.Caption := 'PIN (4-6 digits):';
  AdminPinEdit := TPasswordEdit.Create(BusinessPage);
  AdminPinEdit.Parent := BusinessPage.Surface;
  AdminPinEdit.Top := Y;
  AdminPinEdit.Left := 120;
  AdminPinEdit.Width := 80;
  Y := Y + 28;

  ShowCredentialsCheckbox := TNewCheckBox.Create(BusinessPage);
  ShowCredentialsCheckbox.Parent := BusinessPage.Surface;
  ShowCredentialsCheckbox.Top := Y;
  ShowCredentialsCheckbox.Left := 0;
  ShowCredentialsCheckbox.Width := 200;
  ShowCredentialsCheckbox.Caption := 'Show password and PIN';
  ShowCredentialsCheckbox.OnClick := @ShowCredentialsClick;
  Y := Y + 24;

  Lbl := TNewStaticText.Create(BusinessPage);
  Lbl.Parent := BusinessPage.Surface;
  Lbl.Top := Y;
  Lbl.Left := 0;
  Lbl.Caption := 'All fields required. Password: 8+ chars, digit, lowercase, special char. PIN: 4-6 digits.';
  Lbl.Font.Size := 7;
end;

// ─── Data Options page ─────────────────────────────────────────────────────
procedure CreateDataOptionsPage;
var
  Lbl: TNewStaticText;
begin
  DataOptionsPage := CreateCustomPage(BusinessPage.ID,
    'Data Options',
    'Choose whether to keep or remove existing application data.');

  Lbl := TNewStaticText.Create(DataOptionsPage);
  Lbl.Parent := DataOptionsPage.Surface;
  Lbl.Top := 16;
  Lbl.Left := 0;
  Lbl.Width := DataOptionsPage.SurfaceWidth;
  Lbl.WordWrap := True;
  Lbl.Caption := 'The database containing your orders, menu, and settings is stored in your AppData folder. Check the box below to permanently delete it and start fresh.';

  DeleteDataCheckbox := TNewCheckBox.Create(DataOptionsPage);
  DeleteDataCheckbox.Parent := DataOptionsPage.Surface;
  DeleteDataCheckbox.Top := 80;
  DeleteDataCheckbox.Left := 0;
  DeleteDataCheckbox.Width := DataOptionsPage.SurfaceWidth;
  DeleteDataCheckbox.Caption := 'Delete all application data (orders, menu, settings)';

  Lbl := TNewStaticText.Create(DataOptionsPage);
  Lbl.Parent := DataOptionsPage.Surface;
  Lbl.Top := 110;
  Lbl.Left := 0;
  Lbl.Caption := 'Warning: This cannot be undone.';
  Lbl.Font.Style := [fsBold];
end;

// ─── Page visibility ───────────────────────────────────────────────────────
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  Result := False;
  // Skip Business Setup page in terminal mode
  if (PageID = BusinessPage.ID) and DeployModeTerminal.Checked then
    Result := True;
end;

// ─── Validation helpers ────────────────────────────────────────────────────
function HasDigit(const S: string): Boolean;
var I: Integer;
begin
  Result := False;
  for I := 1 to Length(S) do
    if (S[I] >= '0') and (S[I] <= '9') then begin Result := True; Exit; end;
end;

function HasLowercase(const S: string): Boolean;
var I: Integer;
begin
  Result := False;
  for I := 1 to Length(S) do
    if (S[I] >= 'a') and (S[I] <= 'z') then begin Result := True; Exit; end;
end;

function HasNonAlphanumeric(const S: string): Boolean;
var I: Integer; C: Char;
begin
  Result := False;
  for I := 1 to Length(S) do
  begin
    C := S[I];
    if not (((C >= 'a') and (C <= 'z')) or ((C >= 'A') and (C <= 'Z')) or ((C >= '0') and (C <= '9'))) then
    begin Result := True; Exit; end;
  end;
end;

function AllDigits(const S: string): Boolean;
var I: Integer;
begin
  Result := True;
  for I := 1 to Length(S) do
    if (S[I] < '0') or (S[I] > '9') then begin Result := False; Exit; end;
end;

// ─── Validation ────────────────────────────────────────────────────────────
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;

  if CurPageID = BusinessPage.ID then
  begin
    if (AdminNameEdit.Text = '') or (AdminEmailEdit.Text = '') or
       (AdminPasswordEdit.Text = '') or (AdminPinEdit.Text = '') then
    begin
      MsgBox('All admin account fields are required: name, email, password, and PIN.', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // Identity password policy: >= 8 chars, digit, lowercase, non-alphanumeric
    if Length(AdminPasswordEdit.Text) < 8 then
    begin
      MsgBox('Password must be at least 8 characters.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if not HasDigit(AdminPasswordEdit.Text) then
    begin
      MsgBox('Password must contain at least one digit (0-9).', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if not HasLowercase(AdminPasswordEdit.Text) then
    begin
      MsgBox('Password must contain at least one lowercase letter (a-z).', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if not HasNonAlphanumeric(AdminPasswordEdit.Text) then
    begin
      MsgBox('Password must contain at least one special character (e.g. !@#$%).', mbError, MB_OK);
      Result := False;
      Exit;
    end;

    // PIN: 4-6 digits only
    if (Length(AdminPinEdit.Text) < 4) or (Length(AdminPinEdit.Text) > 6) then
    begin
      MsgBox('PIN must be 4-6 digits.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    if not AllDigits(AdminPinEdit.Text) then
    begin
      MsgBox('PIN must contain only digits (0-9).', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  end;
end;

// ─── Post-install: write config files ──────────────────────────────────────
procedure WriteDeploymentJson;
var
  Mode, ApiUrl, Content, Path: string;
begin
  if DeployModeStandalone.Checked then
    Mode := 'standalone'
  else
    Mode := 'terminal';
  ApiUrl := ApiUrlEdit.Text;

  Content := '{' +
    '"mode":"' + JsonEscape(Mode) + '",' +
    '"apiUrl":"' + JsonEscape(ApiUrl) + '",' +
    '"apiPort":5000' +
    '}';

  Path := ExpandConstant('{app}\deployment.json');
  if not SaveStringToFile(Path, Content, False) then
    MsgBox('Failed to write deployment.json to:' + #13#10 + Path, mbError, MB_OK);
end;

procedure WriteBootstrapJson;
var
  TaxPctInt, TmpInt: Integer;
  TaxRate: string;
  Content, ApiDir, Path: string;
begin
  // Only for standalone mode with all fields filled
  if DeployModeTerminal.Checked then Exit;
  if (AdminNameEdit.Text = '') or (AdminEmailEdit.Text = '') or
     (AdminPasswordEdit.Text = '') or (AdminPinEdit.Text = '') then Exit;

  // Convert percentage to decimal (e.g. "15" -> "0.15")
  // Use integer parsing since tax rates are whole numbers
  TaxPctInt := StrToIntDef(TaxRateEdit.Text, 15);
  TaxRate := Format('0.%2.2d', [TaxPctInt]);

  Content := '{' +
    '"admin":{' +
      '"displayName":"' + JsonEscape(AdminNameEdit.Text) + '",' +
      '"email":"' + JsonEscape(AdminEmailEdit.Text) + '",' +
      '"password":"' + JsonEscape(AdminPasswordEdit.Text) + '",' +
      '"pin":"' + JsonEscape(AdminPinEdit.Text) + '"' +
    '},' +
    '"businessSettings":{' +
      '"storeName":"' + JsonEscape(StoreNameEdit.Text) + '",' +
      '"taxRate":' + TaxRate + ',' +
      '"currency":"' + JsonEscape(CurrencyCombo.Items[CurrencyCombo.ItemIndex]) + '"' +
    '}' +
    '}';

  ApiDir := ExpandConstant('{app}\resources\api');
  ForceDirectories(ApiDir);
  Path := ApiDir + '\bootstrap.json';
  if not SaveStringToFile(Path, Content, False) then
    MsgBox('Failed to write bootstrap.json to:' + #13#10 + Path + #13#10 +
           'The admin account will not be seeded. Use /api/auth/setup after launch.',
           mbError, MB_OK)
  else
  begin
    // Grant the current user modify permission so the API process (non-admin)
    // can delete the file after consuming it. Without this, Program Files ACLs
    // block File.Delete and File.WriteAllText, leaving credentials on disk.
    Exec('icacls.exe', '"' + Path + '" /grant "' + GetUserNameString + '":(M)', '', SW_HIDE, ewWaitUntilTerminated, TmpInt);
  end;
end;

procedure WriteJwtSecret;
var
  ApiDir, Path, Key, Content: string;
begin
  ApiDir := ExpandConstant('{app}\resources\api');
  ForceDirectories(ApiDir);
  Path := ApiDir + '\appsettings.Desktop.local.json';

  // Idempotent: preserve existing key on upgrade
  if FileExists(Path) then Exit;

  Key := GenerateRandomKey(64);
  Content := '{"Jwt":{"Secret":"' + JsonEscape(Key) + '"}}';
  SaveStringToFile(Path, Content, False);
end;

procedure DeleteUserData;
var
  DataDir: string;
begin
  if DeleteDataCheckbox.Checked then
  begin
    DataDir := ExpandConstant('{userappdata}\brewbar-pos-desktop');
    if DirExists(DataDir) then
      DelTree(DataDir, True, True, True);
  end;
end;

// ─── Lifecycle hooks ───────────────────────────────────────────────────────
procedure InitializeWizard;
begin
  CreateDeployModePage;
  CreateBusinessPage;
  CreateDataOptionsPage;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    WriteDeploymentJson;
    WriteBootstrapJson;
    WriteJwtSecret;
    DeleteUserData;
  end;
end;

// ─── Uninstall: offer to delete data ───────────────────────────────────────
function InitializeUninstall: Boolean;
begin
  Result := True;
  if MsgBox('Do you also want to delete all application data (orders, menu, settings)?'#13#10 +
            'This cannot be undone.', mbConfirmation, MB_YESNO) = IDYES then
  begin
    DelTree(ExpandConstant('{userappdata}\brewbar-pos-desktop'), True, True, True);
  end;
end;
