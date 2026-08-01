#!/bin/bash

# Build script for aseprite-mcp Docker image

set -e

IMAGE_NAME="aseprite-mcp"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"

echo "Building Docker image: ${FULL_IMAGE_NAME}"

# Build the Docker image
docker build -t "${FULL_IMAGE_NAME}" .

echo "Docker image built successfully!"
echo ""
echo "Image details:"
docker images "${FULL_IMAGE_NAME}"
echo ""
echo "To run the container:"
echo "  docker run -it --rm ${FULL_IMAGE_NAME}"
echo ""
echo "To run with volume mount for development:"
echo "  docker run -it --rm -v \$(pwd):/app ${FULL_IMAGE_NAME}"
echo ""
echo "To run interactively:"
echo "  docker run -it --rm --entrypoint /bin/bash ${FULL_IMAGE_NAME}"
echo ""
echo "To test the image:"
echo "  docker run --rm ${FULL_IMAGE_NAME} node --version"
