# Get the directory where the script is located
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Set the current location to the script's directory to ensure commands run in the correct context
Set-Location $scriptDir

# Install dependencies if node_modules doesn't exist
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies for the Landlord game..."
    npm install
}

# Run the development server
Write-Host "Starting the Landlord game development server..."
npm run dev
