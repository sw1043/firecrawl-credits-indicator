import subprocess


def execute(command) -> str:
    """
    Execute a shell command and return its output. If an error occurs, return the error message.
    """
    try:
        result = subprocess.run(command, shell=True, capture_output=True, text=True)
        return result.stdout + result.stderr
    except Exception as e:
        return f"Error: {str(e)}"

def parse(raw_output) -> dict:
    """
    Parse the raw output from the command execution and return a structured dictionary.
    This is a placeholder function and should be implemented based on the expected output format.
    """
    parsed_data = {}
    lines = raw_output.splitlines()
    for line in lines:
        if ":" in line:
            key, value = line.split(":", 1)
            parsed_data[key.strip()] = value.strip()
    return parsed_data

def auth() -> bool:
    response = execute("firectl whoami")
    parsed_data = parse(response)
    if 'Account ID' in parsed_data.keys():
        return True
    return False

def get_credits() -> float:
    response = execute("firectl account get")
    parsed_data = parse(response)
    return float(parsed_data.get('Balance', 'USD 0').replace('USD', '').strip())

def main():
    while not auth():
        execute("firectl signin")
    print(get_credits())  ## temporal implementation

if __name__ == "__main__":
    main()
