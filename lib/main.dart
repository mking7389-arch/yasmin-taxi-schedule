import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Kör `flutterfire configure` och ersätt med:
  // await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  await Firebase.initializeApp();
  runApp(const YasminTaxiApp());
}

class YasminTaxiApp extends StatelessWidget {
  const YasminTaxiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Yasmin Taxi – schema',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF146C5A)),
        useMaterial3: true,
        inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
      ),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, authSnapshot) {
        if (authSnapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        final user = authSnapshot.data;
        if (user == null) return const LoginPage();
        return FutureBuilder(
          key: ValueKey(user.uid),
          future: FirebaseFirestore.instance.collection('users').doc(user.uid).get(),
          builder: (context, profileSnapshot) {
            if (profileSnapshot.connectionState == ConnectionState.waiting) {
              return const Scaffold(body: Center(child: CircularProgressIndicator()));
            }
            if (profileSnapshot.hasError || !profileSnapshot.hasData || !profileSnapshot.data!.exists) {
              return Scaffold(
                body: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const Text('Kontot saknar en användarprofil. Kontakta administratören.'),
                      TextButton(onPressed: FirebaseAuth.instance.signOut, child: const Text('Logga ut')),
                    ]),
                  ),
                ),
              );
            }
            final role = profileSnapshot.data!.data()?['role'];
            if (role != 'admin' && role != 'employee') {
              return Scaffold(body: Center(child: TextButton(
                onPressed: FirebaseAuth.instance.signOut,
                child: const Text('Ogiltig roll. Logga ut.'),
              )));
            }
            return SchedulePage(isAdmin: role == 'admin');
          },
        );
      },
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _busy = true; _error = null; });
    try {
      await FirebaseAuth.instance.signInWithEmailAndPassword(
        email: _email.text.trim(), password: _password.text,
      );
    } on FirebaseAuthException catch (error) {
      setState(() => _error = error.message ?? 'Kunde inte logga in. Kontrollera uppgifterna.');
    } catch (_) {
      setState(() => _error = 'Något gick fel. Försök igen.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Form(
              key: _formKey,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Icon(Icons.local_taxi, size: 64, color: Color(0xFF146C5A)),
                const SizedBox(height: 12),
                Text('Yasmin Taxi', textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
                const Text('Logga in för att se ditt schema', textAlign: TextAlign.center),
                const SizedBox(height: 28),
                TextFormField(controller: _email, keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'E-post', prefixIcon: Icon(Icons.email_outlined)),
                  validator: (value) => value == null || !value.contains('@') ? 'Ange en giltig e-postadress' : null),
                const SizedBox(height: 14),
                TextFormField(controller: _password, obscureText: true,
                  decoration: const InputDecoration(labelText: 'Lösenord', prefixIcon: Icon(Icons.lock_outline)),
                  validator: (value) => value == null || value.isEmpty ? 'Ange ditt lösenord' : null,
                  onFieldSubmitted: (_) => _signIn()),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                const SizedBox(height: 20),
                FilledButton(onPressed: _busy ? null : _signIn,
                  child: _busy ? const SizedBox(width: 20, height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Logga in')),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}

class SchedulePage extends StatelessWidget {
  const SchedulePage({required this.isAdmin, super.key});
  final bool isAdmin;

  Query<Map<String, dynamic>> _scheduleQuery() {
    final schedules = FirebaseFirestore.instance.collection('schedules');
    if (isAdmin) return schedules.orderBy('startAt');
    return schedules.where('employeeId', isEqualTo: FirebaseAuth.instance.currentUser!.uid)
        .orderBy('startAt');
  }

  String _date(DateTime value) {
    final local = value.toLocal();
    String two(int number) => number.toString().padLeft(2, '0');
    return '${two(local.day)}/${two(local.month)}/${local.year}  ${two(local.hour)}:${two(local.minute)}';
  }

  Future<void> _addShift(BuildContext context) async {
    final formKey = GlobalKey<FormState>();
    final uid = TextEditingController();
    final name = TextEditingController();
    final note = TextEditingController();
    DateTime start = DateTime.now().add(const Duration(days: 1));
    DateTime end = start.add(const Duration(hours: 8));
    try {
      final saved = await showDialog<bool>(context: context, builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Lägg till arbetspass'),
          content: SizedBox(width: 440, child: SingleChildScrollView(child: Form(
            key: formKey,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextFormField(controller: uid, decoration: const InputDecoration(labelText: 'Anställds UID'),
                validator: (value) => value == null || value.trim().isEmpty ? 'Ange användarens UID' : null),
              const SizedBox(height: 12),
              TextFormField(controller: name, decoration: const InputDecoration(labelText: 'Anställds namn'),
                validator: (value) => value == null || value.trim().isEmpty ? 'Ange namn' : null),
              const SizedBox(height: 12),
              ListTile(contentPadding: EdgeInsets.zero, title: const Text('Start'), subtitle: Text(_date(start)),
                trailing: const Icon(Icons.calendar_month), onTap: () async {
                  final day = await showDatePicker(context: context, initialDate: start,
                    firstDate: DateTime.now().subtract(const Duration(days: 365)),
                    lastDate: DateTime.now().add(const Duration(days: 730)));
                  if (day == null || !context.mounted) return;
                  final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(start));
                  if (time != null) setDialogState(() => start = DateTime(day.year, day.month, day.day, time.hour, time.minute));
                }),
              ListTile(contentPadding: EdgeInsets.zero, title: const Text('Slut'), subtitle: Text(_date(end)),
                trailing: const Icon(Icons.schedule), onTap: () async {
                  final day = await showDatePicker(context: context, initialDate: end,
                    firstDate: DateTime.now().subtract(const Duration(days: 365)),
                    lastDate: DateTime.now().add(const Duration(days: 730)));
                  if (day == null || !context.mounted) return;
                  final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(end));
                  if (time != null) setDialogState(() => end = DateTime(day.year, day.month, day.day, time.hour, time.minute));
                }),
              TextFormField(controller: note, decoration: const InputDecoration(labelText: 'Anteckning (valfritt)')),
            ]),
          ))),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Avbryt')),
            FilledButton(onPressed: () {
              if (formKey.currentState!.validate() && end.isAfter(start)) Navigator.pop(dialogContext, true);
            }, child: const Text('Spara')),
          ],
        ),
      ));
      if (saved != true) return;
      if (!end.isAfter(start)) {
        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Sluttiden måste vara efter starttiden.')));
        return;
      }
      await FirebaseFirestore.instance.collection('schedules').add({
        'employeeId': uid.text.trim(), 'employeeName': name.text.trim(),
        'startAt': Timestamp.fromDate(start), 'endAt': Timestamp.fromDate(end),
        'note': note.text.trim(), 'createdAt': FieldValue.serverTimestamp(),
      });
    } catch (error) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Kunde inte spara passet: $error')));
    } finally {
      uid.dispose(); name.dispose(); note.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(isAdmin ? 'Admin – schema' : 'Mitt schema'),
        actions: [IconButton(tooltip: 'Logga ut', onPressed: FirebaseAuth.instance.signOut,
          icon: const Icon(Icons.logout))]),
      body: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
        stream: _scheduleQuery().snapshots(),
        builder: (context, snapshot) {
          if (snapshot.hasError) return const Center(child: Padding(
            padding: EdgeInsets.all(24), child: Text('Kunde inte läsa schemat. Kontrollera Firestore-reglerna och indexen.')));
          if (snapshot.connectionState == ConnectionState.waiting) return const Center(child: CircularProgressIndicator());
          final docs = snapshot.data?.docs ?? [];
          if (docs.isEmpty) return Center(child: Text(isAdmin ? 'Inga pass ännu. Lägg till ett med +.' : 'Du har inga schemalagda pass ännu.'));
          return ListView.separated(
            padding: const EdgeInsets.all(16), itemCount: docs.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final doc = docs[index]; final data = doc.data();
              final start = (data['startAt'] as Timestamp).toDate();
              final end = (data['endAt'] as Timestamp).toDate();
              return Card(child: ListTile(leading: const CircleAvatar(child: Icon(Icons.local_taxi)),
                title: Text(isAdmin ? (data['employeeName'] ?? 'Anställd') : _date(start)),
                subtitle: Text(isAdmin
                  ? '${_date(start)} – ${_date(end)}${(data['note'] as String? ?? '').isEmpty ? '' : '\n${data['note']}'}'
                  : 'Slutar ${_date(end)}${(data['note'] as String? ?? '').isEmpty ? '' : '\n${data['note']}'}'),
                isThreeLine: (data['note'] as String? ?? '').isNotEmpty,
                trailing: isAdmin ? IconButton(tooltip: 'Ta bort pass', icon: const Icon(Icons.delete_outline),
                  onPressed: () async {
                    final confirm = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(
                      title: const Text('Ta bort arbetspass?'),
                      actions: [TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: const Text('Avbryt')),
                        FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: const Text('Ta bort'))],
                    ));
                    if (confirm == true) await FirebaseFirestore.instance.collection('schedules').doc(doc.id).delete();
                  }) : null,
              ));
            },
          );
        },
      ),
      floatingActionButton: isAdmin ? FloatingActionButton.extended(
        onPressed: () => _addShift(context), icon: const Icon(Icons.add), label: const Text('Lägg till pass')) : null,
    );
  }
}
