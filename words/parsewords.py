freq = open("wordfrequency5000.txt")
dictionary = open("dictionary.txt")

defs = [l.split(".")[0] for l in dictionary.read().replace("\xe2\x80\x94","").split("\n")]
defs = [d.split(" ") for d in defs if len(d.split(" ")) == 3]
defs = {d[0].lower(): d[2] for d in defs}

def is_num(s):
    try:
        float(s)
        return True
    except ValueError:
        return False

freqs = [l.split("\t") for l in freq.read().replace("   ","").split("\n")[1:]]
freqs = [f for f in freqs if len(f) == 5 and is_num(f[3])]

nvs = [f for f in freqs if f[1].lower() in defs and defs[f[1].lower()] in ['n','v']]
nvs = [(n[1],n[3],defs[n[1].lower()]) for n in nvs]

script = "drop table if exists words;" +\
         "create table words (id SERIAL, word varchar(40), frequency integer, nounorverb char(1));\n"

def quoted(s): return "'" + s + "'"
script += "\n".join(["insert into words (word,frequency,nounorverb) " +\
                            "values ({},{},{});".format(quoted(n[0]),n[1],quoted(n[2])) for n in nvs])

print(script)
