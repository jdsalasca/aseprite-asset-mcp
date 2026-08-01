# Build script for aseprite-mcp Docker image (PowerShell)

$ErrorActionPreference = "Stop"

$IMAGE_NAME = "aseprite-mcp"
$IMAGE_TAG = "latest"
$FULL_IMAGE_NAME = "${IMAGE_NAME}:${IMAGE_TAG}"

Write-Host "Building Docker image: $FULL_IMAGE_NAME" -ForegroundColor Green

try {
    # Build the Docker image
    docker build -t $FULL_IMAGE_NAME .

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Docker image built successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Image details:" -ForegroundColor Yellow
        docker images $FULL_IMAGE_NAME
        Write-Host ""
        Write-Host "To run the container:" -ForegroundColor Yellow
        Write-Host "  docker run -it --rm $FULL_IMAGE_NAME" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To run with volume mount for development:" -ForegroundColor Yellow
        Write-Host "  docker run -it --rm -v `${PWD}:/app $FULL_IMAGE_NAME" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To run interactively:" -ForegroundColor Yellow
        Write-Host "  docker run -it --rm --entrypoint /bin/bash $FULL_IMAGE_NAME" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "To test the image:" -ForegroundColor Yellow
        Write-Host "  docker run --rm $FULL_IMAGE_NAME node --version" -ForegroundColor Cyan
    } else {
        throw "Docker build failed with exit code $LASTEXITCODE"
    }
} catch {
    Write-Host "Docker build failed: $_" -ForegroundColor Red
    exit 1
}
