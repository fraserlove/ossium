ifeq ($(OS),Windows_NT)
	PYTHON := python
else
	PYTHON := python3
endif

install:
	yarn install
	$(PYTHON) -m venv venv
	./venv/bin/pip install -r requirements.txt

start:
	yarn webpack --mode production & ./venv/bin/python3 app.py $(RESOURCES)

clean:
	rm -rf ./node_modules
	rm -rf ./static/dist
	rm -rf __pycache__
	rm -rf venv
	