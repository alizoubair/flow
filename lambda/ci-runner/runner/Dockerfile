FROM amazonlinux:2023

# Node.js 20
RUN dnf install -y nodejs npm python3 python3-pip git tar unzip \
    && dnf clean all

# AWS CLI
RUN pip3 install --no-cache-dir boto3 awscli

WORKDIR /app
COPY runner.py requirements.txt ./

EXPOSE 9000
CMD ["python3", "runner.py"]
