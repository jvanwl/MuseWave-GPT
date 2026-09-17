FROM pytorch/pytorch:2.7.1-cuda12.8-cudnn9-runtime
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY musewave_engine ./musewave_engine
COPY train.py .
ENV PYTHONPATH=/app
CMD ["uvicorn", "musewave_engine.api:app", "--host", "0.0.0.0", "--port", "8080"]

