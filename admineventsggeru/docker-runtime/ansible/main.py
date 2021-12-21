#!/usr/bin/env python3
import http.server
import json
import pprint
import subprocess
import os
import uuid
import logging

def ansible_run(playbook, vars_file_path):
    cmd = "ansible-playbook -i /etc/ansible/hosts /srv/campuz-devops/" +\
          playbook + ".yml" + " -e @" + vars_file_path + " -e @" + os.getenv("VARIABLES_PATH") + " --limit=localhost >> /tmp/site_create_log"
    proc = subprocess.Popen(cmd,
                            stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE,
                            shell=True,
                            )

    try:
        outs, errs = proc.communicate(timeout=900)
        pprint.pprint(outs.decode().split('\n'))
        if proc.returncode == 0:
            is_error = False
        else:
            is_error = True
    except subprocess.SubprocessError as errs:
        proc.kill()
        is_error = True

    return is_error, errs

def answer_plain(text,server,code):
    server.send_response(code)
    server.send_header("Content-Type", "text/plain")
    server.end_headers()
    server.wfile.write(bytes(str(text), "utf8"))
    server.wfile.flush()


class AnsibleHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(s):
        logging.basicConfig(filename='ansible.log', encoding='utf-8', level=logging.DEBUG)

        request_path = str(s.path)
        logging.info("POST request,\nPath: %s\nHeaders:\n%s\n", str(s.path), str(s.headers))
        paths = ["/create_site", "/create_mr", "/copy_site"]
        if request_path in paths:
            if s.headers.get('Content-type') == "application/json":
                try:
                    length = int(s.headers.get('content-length'))
                    body = json.loads(s.rfile.read(length))
                except Exception as e:
                    error = "Can't parse json: {}".format(e)
                    logging.error(error)
                    answer_plain(error, s, 400)
                    return
                vars_file_path = "/tmp/" + str(uuid.uuid4()) + ".json"
                with open(vars_file_path, 'w') as fp:
                    json.dump(body, fp)
                is_ansible_error, ansible_error = ansible_run(request_path.replace("/", ""), vars_file_path)
                os.remove(vars_file_path)
                if is_ansible_error:
                    error = "Операция не выполнена. Ошибка: {}".format(ansible_error)
                    logging.error(error)
                    answer_plain("Операция не выполнена. Обратитесь к системному администратору.", s, 400)
                else:
                    message = "Операция выполнена успешно"
                    logging.info(message)
                    answer_plain(message, s, 200)
                return
            else:
                error = "Only Content-Type application/json is supported"
                logging.error(error)
                answer_plain(error, s, 400)
                return
        else:
            error = "Path is not supported: " + request_path
            logging.error(error)
            answer_plain(error, s,400)
            return

def main():
    HOST_NAME = '0.0.0.0'
    PORT_NUMBER = 8080
    server_class = http.server.HTTPServer
    httpd = server_class((HOST_NAME, PORT_NUMBER), AnsibleHandler)
    httpd.serve_forever()


if __name__ == "__main__":
    main()



