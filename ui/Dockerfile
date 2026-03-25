FROM python:3.12-slim

WORKDIR /app

# Install UI dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project source (needed for components that import from agents/graph/scripts)
COPY .. /project
ENV PYTHONPATH=/project

# Copy UI source
COPY . /app/ui
WORKDIR /app/ui

EXPOSE 8501

CMD ["streamlit", "run", "app.py", \
     "--server.port=8501", \
     "--server.address=0.0.0.0", \
     "--server.headless=true"]
