# Limite de tempo para qualquer comando externo. O macOS não traz `timeout`.
# Roda o comando num grupo de processos próprio e, no limite, encerra o grupo inteiro:
# um filho órfão (como o ssh do limactl) prenderia a saída de um $(...) para sempre.
# Uso: com_limite segundos comando [argumentos]. Sai com 124 quando estoura.
com_limite() {
  perl -e '
    my $limite_segundos = shift @ARGV;
    my $pid_comando = fork();
    die "fork falhou: $!" unless defined $pid_comando;
    if ($pid_comando == 0) {
      setpgrp(0, 0);
      exec { $ARGV[0] } @ARGV or exit 127;
    }
    sub encerrar_grupo {
      my ($codigo_saida) = @_;
      kill "TERM", -$pid_comando;
      sleep 2;
      kill "KILL", -$pid_comando;
      exit $codigo_saida;
    }
    $SIG{ALRM} = sub { encerrar_grupo(124) };
    # Um limite externo encerra este processo: o grupo do comando vai junto.
    $SIG{TERM} = sub { encerrar_grupo(143) };
    $SIG{INT} = sub { encerrar_grupo(130) };
    alarm $limite_segundos;
    waitpid($pid_comando, 0);
    my $sinal_recebido = $? & 127;
    exit($sinal_recebido ? 128 + $sinal_recebido : $? >> 8);
  ' "$@"
}
